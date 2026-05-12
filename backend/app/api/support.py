from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.support import SupportTicket
from app.models.user import User
from app.schemas.support import SupportTicketCreate, SupportTicketOut
from app.security import decode_access_token

router = APIRouter(prefix="/support", tags=["support"])
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_optional_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
    except JWTError:
        return None
    return db.query(User).filter(User.id == user_id).first()


@router.post("/tickets", response_model=SupportTicketOut, status_code=201)
def create_support_ticket(
    ticket_in: SupportTicketCreate,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> SupportTicket:
    name = ticket_in.name or (current_user.name if current_user else None)
    email = str(ticket_in.email) if ticket_in.email else (current_user.email if current_user else None)
    ticket = SupportTicket(
        user_id=current_user.id if current_user else None,
        name=name,
        email=email,
        subject=ticket_in.subject.strip(),
        message=ticket_in.message.strip(),
        source=ticket_in.source.strip() or "web",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
