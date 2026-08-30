/** better-auth stores one name; the profile step edits it as two fields */
export const splitName = (
  name: string,
): { firstName: string; lastName: string } => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
};

export const initialsOf = (
  firstName: string,
  lastName: string,
  email: string,
): string => {
  const letters = [firstName, lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join('');

  return (letters || email.charAt(0)).toUpperCase();
};
