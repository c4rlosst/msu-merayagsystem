'use server';

import { createHmac, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { database, storageAdmin, saveSession, clearSession, requireRole } from '../lib/session.js';
import { reasons } from '../lib/clinic.js';
import { fetchBookings } from '../lib/bookings.js';
import { staffAccount, staffPattern } from '../lib/staff-id.js';

const uid = z.uuid();
const detail = (id) => '/clinic/appointment/' + id;
const emailField = z.email().max(254);

async function limited(scope, value) {
  const key = createHmac('sha256', process.env.CLINIC_SESSION_KEY).update(value).digest('hex');
  const { data } = await storageAdmin().rpc('consume_clinic_limit', { limit_scope: scope, limit_key: key });
  return data !== true;
}

// `kind` is false for students, or 'staff' for the nurse / administrator ID-and-password sign-in.
export async function signIn(kind, _, form) {
  const nurse = Boolean(kind);
  const nurseId = String(form.get('nurse_id') ?? '').trim().toUpperCase();
  const staffRole = staffPattern.nurse.test(nurseId) ? 'nurse' : staffPattern.admin.test(nurseId) ? 'admin' : null;
  if (nurse && !staffRole) return { error: 'Enter your staff ID, such as N-01 or A-01.' };
  const email = emailField.safeParse(nurse
    ? staffAccount(nurseId)
    : String(form.get('email') ?? '').trim().toLowerCase());
  if (!email.success) return { error: 'Enter a valid school email address.' };
  const code = String(form.get('code') ?? '').trim();
  if (code && !/^\d{6,10}$/.test(code)) return { email: email.data, error: 'Enter the code from your school email.' };
  const domains = (process.env.CLINIC_SCHOOL_DOMAINS ?? 'msugensan.edu.ph')
    .split(',').map((domain) => domain.trim().toLowerCase());
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from(process.env.CLINIC_SESSION_KEY ?? '', 'base64').length !== 32) {
    return { error: 'Clinic sign-in is being configured. Try again later.' };
  }
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  if (await limited('sign_in_ip', ip) || await limited('sign_in_email', email.data)) {
    return { email: code ? email.data : undefined, error: 'Too many attempts or sign-in is unavailable. Try again in a minute.' };
  }
  const auth = database().auth;
  const password = form.get('password');
  if (nurse && (typeof password !== 'string' || form.has('create_account'))) {
    return { error: 'Enter your staff email and clinic account password.' };
  }
  if (password !== null) {
    if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
      return { error: 'Enter your clinic account password.' };
    }
    if (form.get('create_account') === 'yes') {
      if (!domains.includes(email.data.split('@')[1])) {
        return { error: 'Use your @msugensan.edu.ph email address to create an account.' };
      }
      if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
        return { error: 'Use a password with at least 6 characters and at most 72 bytes.' };
      }
      const { data, error } = await auth.signUp({ email: email.data, password });
      if (error || data.session) {
        return { error: 'Account creation could not be completed. Check your details or contact the infirmary.' };
      }
      return { email: email.data, message: 'Enter the verification code from your university email.' };
    }
    const { data, error } = await auth.signInWithPassword({ email: email.data, password });
    if (error || !data.session || !data.user?.email_confirmed_at) {
      return { error: nurse
        ? 'Sign-in failed. Check your staff ID and password, or contact the infirmary.'
        : 'Sign-in failed. Check your email and clinic account password, or contact the infirmary.' };
    }
    const { data: role } = await database(data.session.access_token).rpc('current_clinic_role');
    if (nurse && role !== staffRole) return { error: 'This account does not have active ' + staffRole + ' access.' };
    if (!role || (role === 'student' && !domains.includes(email.data.split('@')[1]))) {
      return { error: 'Use your approved university account to sign in.' };
    }
    await saveSession(data.session);
    redirect('/clinic');
  }
  if (!code) {
    const { error } = await auth.signInWithOtp({
      email: email.data, options: { shouldCreateUser: domains.includes(email.data.split('@')[1]) }
    });
    if (error?.status === 429) return { error: 'Please wait a minute before requesting another code.' };
    if (error) return { error: 'We could not send a sign-in code. Check your school email address or contact the infirmary.' };
    return { email: email.data, message: 'Enter the verification code from your email.' };
  }
  const { data, error } = await auth.verifyOtp({ email: email.data, token: code, type: 'email' });
  if (error || !data.session) return { email: email.data, error: 'That code is invalid or expired. Request a new code.' };
  await saveSession(data.session);
  redirect('/clinic');
}

// Lets the nurse calendar load more months in the background while the nurse moves around it,
// instead of reloading the whole page for every week or month.
export async function loadCalendarRange(from, to) {
  const { db } = await requireRole('nurse');
  const range = z.object({ from: z.iso.date(), to: z.iso.date() }).safeParse({ from, to });
  if (!range.success) return { error: 'Choose a valid date range.' };
  const days = (Date.parse(range.data.to) - Date.parse(range.data.from)) / 86400000;
  if (!(days > 0 && days <= 130)) return { error: 'Choose a shorter date range.' };
  try {
    return { bookings: await fetchBookings(db, range.data.from, range.data.to) };
  } catch {
    return { error: 'Could not load the calendar. Try again.' };
  }
}

export async function signOut() {
  await clearSession();
  redirect('/');
}

export async function manageStaffAccess(_, form) {
  const { db } = await requireRole('admin');
  const input = z.object({
    email: emailField,
    role: z.enum(['nurse', 'physician']),
    access: z.enum(['grant', 'revoke'])
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'Enter the staff account email and choose a role.' };

  const { email, role, access } = input.data;
  const { error } = await db.rpc('manage_clinic_staff', {
    staff_email: email, staff_role: role, enable_access: access === 'grant'
  });
  if (error) return { error: safeError(error, 'Staff access could not be updated.') };
  redirect('/clinic/admin');
}

export async function createNurseAccount(_, form) {
  const { db } = await requireRole('admin');
  const id = String(form.get('nurse_id') ?? '').trim().toUpperCase();
  const password = form.get('password');
  if (!/^N-?[0-9]{2,8}$/.test(id)) return { error: 'Enter a nurse ID such as N-01.' };
  const name = z.string().trim().min(1).max(80).safeParse(form.get('full_name'));
  if (!name.success) return { error: 'Enter the nurse’s full name.' };
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    return { error: 'Use a password with at least 6 characters and at most 72 bytes.' };
  }
  const email = staffAccount(id);
  const admin = storageAdmin().auth.admin;
  const { data, error } = await admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name.data } });
  if (error || !data.user) return { error: 'Could not create the account. Check whether the nurse ID is already in use.' };

  const assignment = await db.rpc('manage_clinic_staff', {
    staff_email: email, staff_role: 'nurse', enable_access: true
  });
  if (assignment.error) {
    return { error: 'Account created. Use Assign a role with ' + email + ' to finish granting access.' };
  }
  redirect('/clinic/admin');
}

const profile = z.object({
  student_id: z.string().trim().min(1).max(50), full_name: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(120), year_level: z.coerce.number().int().min(1).max(20),
  contact_number: z.string().trim().regex(/^[+\d(). -]{7,40}$/)
});
const booking = z.object({ urgency: z.enum(['urgent', 'soon', 'flexible']), reason: z.enum(reasons), concern: z.string().trim().min(1).max(4000) });

async function uploadLetter(user, file, required) {
  if (!(file instanceof File) || !file.size) {
    if (required) throw new Error('Attach a letter for a medical certificate request.');
    return {};
  }
  if (file.size > 5242880) throw new Error('Choose a letter no larger than 5 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const signatures = {
    'image/jpeg': 'ffd8ff', 'image/png': '89504e470d0a1a0a', 'application/pdf': '255044462d'
  };
  const signature = signatures[file.type];
  if (!signature || !bytes.toString('hex', 0, 8).startsWith(signature)) {
    throw new Error('Choose a valid JPG, PNG, or PDF.');
  }
  const id = randomUUID();
  const path = user.id + '/' + id;
  const bucket = storageAdmin().storage.from('clinic-letters');
  const { error } = await bucket.upload(path, bytes, { contentType: file.type });
  if (error) throw new Error('The letter could not be uploaded. Try again.');
  return { bucket, path, payload: { letter_object: id, letter_mime: file.type, letter_size: file.size } };
}

export async function submitBooking(_, form) {
  const { db, user } = await requireRole('student');
  const input = booking.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'Choose an urgency level and visit reason, then enter your concern.' };
  if (await limited('booking', user.id)) return { error: 'Too many booking attempts. Try again in a minute.' };
  const { urgency, reason, concern } = input.data;
  let upload;
  try {
    upload = await uploadLetter(user, form.get('letter'), reason === 'Medical certificate');
  } catch (error) {
    return { error: error.message };
  }
  const { data, error } = await db.rpc('request_clinic_appointment', {
    requested_urgency: urgency, visit_reason: reason, student_concern: concern, ...upload.payload
  }).single();
  if (error || !data) {
    if (upload.path && error?.code) {
      const { data: linked, error: lookupError } = await db.from('appointment_attachments')
        .select('appointment_id').eq('object_id', upload.payload.letter_object).maybeSingle();
      if (linked) redirect(detail(linked.appointment_id));
      if (!lookupError && /^[0-9A-Z]{5}$/.test(error.code)) await upload.bucket.remove([upload.path]);
    }
    return { error: safeError(error, 'Your request could not be submitted. Check My appointments before trying again.') };
  }
  redirect(detail(data.id));
}

const slotBooking = z.object({ slot: z.uuid(), reason: z.enum(reasons), concern: z.string().trim().min(1).max(4000) });

// Books one of the open times the nurses published. The database holds the place, so two students
// can't take the last one, and the nurse then confirms the visit.
export async function submitSlotBooking(_, form) {
  const { db, user } = await requireRole('student');
  const input = slotBooking.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'Choose a day and time, a visit reason, and describe your concern.' };
  if (await limited('booking', user.id)) return { error: 'Too many booking attempts. Try again in a minute.' };
  const { slot, reason, concern } = input.data;
  let upload;
  try {
    upload = await uploadLetter(user, form.get('letter'), reason === 'Medical certificate');
  } catch (error) {
    return { error: error.message };
  }
  const { data, error } = await db.rpc('book_clinic_appointment', {
    selected_slot: slot, visit_reason: reason, student_concern: concern, ...upload.payload
  }).single();
  if (error || !data) {
    if (upload.path && error?.code) {
      const { data: linked, error: lookupError } = await db.from('appointment_attachments')
        .select('appointment_id').eq('object_id', upload.payload.letter_object).maybeSingle();
      if (linked) redirect(detail(linked.appointment_id));
      if (!lookupError && /^[0-9A-Z]{5}$/.test(error.code)) await upload.bucket.remove([upload.path]);
    }
    return { error: safeError(error, 'Your booking could not be completed. Check My appointments before trying again.') };
  }
  redirect(detail(data.id));
}

const announcement = z.object({
  title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(600),
  until: z.union([z.literal(''), z.iso.date()]).optional()
});

export async function postAnnouncement(_, form) {
  const { db } = await requireRole('nurse');
  const input = announcement.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'Enter a title (up to 120 characters) and a message (up to 600 characters).' };
  const { error } = await db.rpc('post_clinic_announcement', {
    announcement_title: input.data.title, announcement_body: input.data.body, show_until: input.data.until || null
  });
  if (error) return { error: safeError(error, 'The announcement could not be posted. Try again.') };
  redirect('/clinic/announcements');
}

export async function removeAnnouncement(_, form) {
  const { db } = await requireRole('nurse');
  const id = uid.safeParse(form.get('id'));
  if (!id.success) return { error: 'Choose a valid announcement.' };
  const { error } = await db.rpc('remove_clinic_announcement', { announcement_key: id.data });
  if (error) return { error: safeError(error, 'The announcement could not be removed. Try again.') };
  redirect('/clinic/announcements');
}

function safeError(error, fallback) {
  return error?.code === 'P0001' ? error.message : fallback;
}

const schedule = z.object({
  date: z.iso.date(), opening: z.iso.time({ precision: -1 }), closing: z.iso.time({ precision: -1 }),
  slot_length: z.coerce.number().int().min(1).max(720), slot_capacity: z.coerce.number().int().min(1).max(32767)
});
const numericVisit = ['temperature_c', 'systolic', 'diastolic', 'pulse', 'respiratory_rate', 'spo2', 'height_cm', 'weight_kg'];
const textVisit = ['findings', 'assessment', 'notes'];

export async function clinicAction(kind, _, form) {
  const roles = {
    profile: ['student'], schedule: ['nurse'], edit_schedule: ['nurse'], cancel_schedule: ['nurse'],
    assign_time: ['nurse'], status: ['student', 'nurse'], visit: ['nurse'], authorize: ['physician'], release: ['nurse']
  };
  if (!Object.hasOwn(roles, kind)) return { error: 'This action is unavailable.' };
  const { db, user } = await requireRole(...roles[kind]);
  const fields = Object.fromEntries(form);
  let result;
  let destination = '/clinic';
  if (kind === 'profile') {
    const parsed = profile.safeParse(fields);
    if (!parsed.success) return { error: 'Complete all fields and enter a valid contact number and year level.' };
    result = await db.from('profiles').upsert({ ...parsed.data, user_id: user.id });
    destination = '/clinic/book';
  } else if (kind === 'schedule' || kind === 'edit_schedule') {
    destination = '/clinic/slots';
    const parsed = schedule.safeParse(fields);
    if (!parsed.success || (kind === 'edit_schedule' && !uid.safeParse(fields.id).success)) {
      return { error: 'Enter a valid date, hours, slot length, and capacity.' };
    }
    const { date, ...hours } = parsed.data;
    result = kind === 'schedule'
      ? await db.rpc('publish_clinic_schedule', { clinic_day: date, ...hours })
      : await db.rpc('edit_clinic_schedule', { schedule_key: fields.id, ...hours });
  } else {
    if (!uid.safeParse(fields.id).success) return { error: 'Choose a valid record.' };
    const id = fields.id;
    destination = detail(id);
    switch (kind) {
      case 'assign_time': {
        const time = z.object({
          date: z.iso.date(), start: z.iso.time({ precision: -1 }), end: z.iso.time({ precision: -1 })
        }).safeParse(fields);
        if (!time.success) return { error: 'Choose a date and enter a start and end time.' };
        const { date, start, end } = time.data;
        result = await db.rpc('schedule_clinic_request', {
          appointment_key: id, visit_start: date + 'T' + start + ':00+08:00',
          visit_end: date + 'T' + end + ':00+08:00'
        });
        break;
      }
      case 'cancel_schedule': {
        const reason = z.string().trim().min(1).max(1000).safeParse(fields.explanation);
        if (!reason.success) return { error: 'Enter a cancellation reason.' };
        result = await db.rpc('cancel_clinic_schedule', { schedule_key: id, explanation: reason.data });
        destination = '/clinic/slots';
        break;
      }
      case 'status': {
        const status = z.enum(['confirmed', 'denied', 'cancelled', 'checked_in', 'completed', 'no_show']).safeParse(fields.status);
        const reason = z.string().trim().max(1000).safeParse(fields.explanation ?? '');
        if (!status.success || !reason.success || (status.data === 'denied' && !reason.data)) return { error: 'Choose an action and enter a reason for denial.' };
        result = await db.rpc('change_clinic_appointment_status', { appointment_key: id, new_status: status.data, explanation: reason.data || null });
        break;
      }
      case 'visit': {
        const changes = {};
        for (const name of numericVisit) {
          const value = String(fields[name] ?? '').trim();
          if (!value) { changes[name] = null; continue; }
          const parsed = z.coerce.number().finite().safeParse(value);
          if (!parsed.success) return { error: 'Enter valid numeric measurements.' };
          changes[name] = parsed.data;
        }
        for (const name of textVisit) {
          const parsed = z.string().trim().max(8000).safeParse(fields[name] ?? '');
          if (!parsed.success) return { error: 'Use at most 8,000 characters per clinical field.' };
          changes[name] = parsed.data || null;
        }
        result = await db.rpc('save_clinic_visit', { appointment_key: id, changes });
        break;
      }
      case 'authorize':
      case 'release': {
        const isAuthorization = kind === 'authorize';
        const input = z.string().trim().min(1).max(isAuthorization ? 8000 : 200).safeParse(fields.text);
        if (!input.success) return { error: isAuthorization ? 'Enter the certificate statement.' : 'Enter the release recipient.' };
        result = await db.rpc(isAuthorization ? 'authorize_clinic_certificate' : 'release_clinic_certificate',
          { appointment_key: id, [isAuthorization ? 'certificate_statement' : 'recipient']: input.data });
        if (isAuthorization) destination = '/clinic';
        break;
      }
    }
  }
  if (result?.error) return { error: safeError(result.error, 'The record could not be saved. Check your entries and try again.') };
  redirect(destination);
}


