export type BackgroundOption = {
  id: string;
  label: string;
  image?: string;
};

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: "signature", label: "Signature" },
  {
    id: "developer-setting",
    label: "Developer Desk",
    image: "/developer-setting.png",
  },
  {
    id: "sunrise",
    label: "Sunrise",
    image: "/beautiful-sunrise.png",
  },
  {
    id: "night",
    label: "Night",
    image: "/beautiful-night.png",
  },
];
