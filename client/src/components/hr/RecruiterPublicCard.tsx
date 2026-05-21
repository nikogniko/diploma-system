import { Avatar } from "@mantine/core";
import classes from "./RecruiterPublicCard.module.scss";

export type RecruiterPublicView = {
  fullName: string;
  position?: string | null;
  photoUrl?: string | null;
};

type RecruiterPublicCardProps = {
  data: RecruiterPublicView;
  onClick: () => void;
};

/** Показує компактну публічну візитку рекрутера для вакансій, компаній і кабінету. */
export function RecruiterPublicCard({ data, onClick }: RecruiterPublicCardProps) {
  return <button type="button" className={classes.card} onClick={onClick}>
    <Avatar src={data.photoUrl} size={48} radius="xl" className={classes.avatarRing} />
    <span>
      <strong>{data.fullName}</strong>
      <small>{data.position}</small>
    </span>
  </button>;
}
