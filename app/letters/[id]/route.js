import { NextResponse } from 'next/server';
import { z } from 'zod';
import { identity, storageAdmin } from '../../../lib/session.js';

export async function GET(_request, { params }) {
  const { id } = await params;
  const session = await identity();
  if (!session || !['student', 'nurse'].includes(session.role)) return new Response(null, { status: 403 });
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const { db } = session;
  const [{ data: appointment }, { data: attachment }] = await Promise.all([
    db.from('appointments').select('student_id').eq('id', id).maybeSingle(),
    db.from('appointment_attachments').select('object_id').eq('appointment_id', id).maybeSingle()
  ]);
  if (!appointment || !attachment) return new Response(null, { status: 404 });
  const path = appointment.student_id + '/' + attachment.object_id;
  const { data, error } = await storageAdmin().storage.from('clinic-letters').createSignedUrl(path, 60);
  if (error) return new Response('The clinic letter is unavailable.', { status: 502 });
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
