"""Load profile for the Stratosphere API.

Run against a locally running stack:

    uv run locust -f tests/load/locustfile.py --host http://localhost:8000

Headless, sized for the demo target of low-hundreds of users:

    uv run locust -f tests/load/locustfile.py --host http://localhost:8000 \
        --headless --users 100 --spawn-rate 10 --run-time 3m

Two user classes are defined:

* SteadyStateUser  - a realistic signed-in session. This is the one to watch
  for latency and error rate. It should produce zero 429s; if it does not, a
  limit is set too tight for normal use.
* RateLimitProbe   - deliberately hammers the throttled auth endpoints. Its
  429s are the expected outcome, so they are reported separately rather than
  counted as failures.

Note on X-Forwarded-For: run this through Caddy (not straight at uvicorn) if
you want to exercise the real client-identification path. Hitting uvicorn
directly means every simulated user shares one socket peer address and
therefore one rate-limit bucket.
"""

import itertools
import uuid

from locust import HttpUser, between, events, task

# Tallied by the probe class so expected throttling does not look like failure.
THROTTLED = {"count": 0}


@events.quitting.add_listener
def _report_throttling(environment, **_kwargs):
    print(f"\n[rate-limit probe] 429 responses observed: {THROTTLED['count']}")


def unique_email() -> str:
    return f"load-{uuid.uuid4().hex[:12]}@loadtest.example.com"


_ip_counter = itertools.count(1)


def synthetic_client_ip() -> str:
    """A unique RFC 5737 test address per virtual user."""
    n = next(_ip_counter)
    return f"198.51.{(n // 254) % 254}.{(n % 254) + 1}"


class SteadyStateUser(HttpUser):
    """A signed-in user doing ordinary work. Expect zero 429s here."""

    weight = 9
    wait_time = between(1, 4)

    def on_start(self) -> None:
        self.email = unique_email()
        self.goal_ids: list[str] = []
        # Every virtual user would otherwise share the load generator's single
        # source address and land in one rate-limit bucket, so the run would
        # measure the limiter rather than the application. Give each user a
        # distinct forwarded address to mimic real, separate clients.
        self.client.headers.update({"X-Forwarded-For": synthetic_client_ip()})
        response = self.client.post(
            "/auth/signup",
            json={
                "email": self.email,
                "password": "load-test-password",
                "name": "Load Test User",
            },
            name="POST /auth/signup",
        )
        if response.status_code != 201:
            # Signup is limited to 5/min per address. Behind a single shared
            # egress IP this will throttle; that is a property of the test
            # environment, not the app. Such a user idles rather than skewing
            # the authenticated-endpoint numbers.
            self.token = None
            return
        self.token = response.json()["access_token"]
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @task(10)
    def list_goals(self) -> None:
        self.client.get("/goals", name="GET /goals")

    @task(5)
    def read_profile(self) -> None:
        self.client.get("/me", name="GET /me")

    @task(4)
    def notification_summary(self) -> None:
        self.client.get("/notifications/summary", name="GET /notifications/summary")

    @task(3)
    def create_goal(self) -> None:
        response = self.client.post(
            "/goals",
            json={
                "title": f"Load goal {uuid.uuid4().hex[:8]}",
                "notes": "created by the load test",
                "priority": "medium",
                "is_timed": False,
            },
            name="POST /goals",
        )
        if response.status_code == 201:
            self.goal_ids.append(response.json()["id"])

    @task(2)
    def reflect_on_goal(self) -> None:
        if not self.goal_ids:
            return
        goal_id = self.goal_ids[-1]
        self.client.post(
            f"/goals/{goal_id}/logs",
            json={
                "completed": True,
                "reflection": "Went better than expected today.",
                "emotion_label": "hopeful",
            },
            name="POST /goals/{id}/logs",
        )

    @task(1)
    def delete_goal(self) -> None:
        if not self.goal_ids:
            return
        goal_id = self.goal_ids.pop()
        self.client.delete(f"/goals/{goal_id}", name="DELETE /goals/{id}")


class RateLimitProbe(HttpUser):
    """Deliberately trips the auth limiters. 429 is the pass condition."""

    weight = 1
    wait_time = between(0.1, 0.3)

    @task
    def hammer_login(self) -> None:
        with self.client.post(
            "/auth/login",
            json={"email": "nobody@loadtest.example.com", "password": "wrong-password"},
            name="POST /auth/login (probe)",
            catch_response=True,
        ) as response:
            if response.status_code == 429:
                THROTTLED["count"] += 1
                response.success()
            elif response.status_code == 401:
                # Correct rejection of bad credentials, still within budget.
                response.success()
            else:
                response.failure(f"unexpected status {response.status_code}")
