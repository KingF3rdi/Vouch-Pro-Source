/**
 * Einfaches Zeichen mit farbloser Umrandung (keine Emojis).
 */
export default function OutlineIcon({
  char,
  className = '',
  round = false,
  large = false,
}) {
  const classes = [
    'icon-outline',
    round ? 'icon-outline--round' : '',
    large ? 'icon-outline--lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} aria-hidden="true">
      {char}
    </span>
  );
}
