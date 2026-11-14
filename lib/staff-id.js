// Nurses and administrators sign in with an ID (N-01, A-01) instead of an email address.
// Behind the scenes each ID is a private email address that never receives mail.
export const staffPattern = { nurse: /^N-?[0-9]{2,8}$/, admin: /^A-?[0-9]{2,8}$/ };

export function staffAccount(id) {
  const local = id.replace('-', '').toLowerCase();
  return local + (local.startsWith('a') ? '@admins' : '@nurses') + '.merayag.invalid';
}

/** The ID to show for a staff account (N-01), or the email itself for everyone else. */
export function accountLabel(email) {
  return /@(nurses|admins)\.merayag\.invalid$/.test(email ?? '')
    ? email.split('@')[0].toUpperCase().replace(/^([NA])-?/, '$1-') : email;
}
