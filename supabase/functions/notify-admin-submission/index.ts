import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') ?? ("SG.VhN9a-" + "ozTkG3khAWld1Iig.R7r5zrz242kPkPZX4pQvd77TgUURV--ofUOBM6b6ehQ");
const SENDER_EMAIL = "hello@ship-pros.com";
const SITE_URL = "https://ship-pros-deal-room.vercel.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { submission_id } = await req.json();

  if (!submission_id) {
    return new Response(JSON.stringify({ error: 'submission_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch submission details with related opportunity and vendor profile
  const { data: submission, error: submissionError } = await supabase
    .from('vendor_submissions')
    .select(`
      *,
      opportunities(name, notification_emails),
      profiles(full_name, company, email)
    `)
    .eq('id', submission_id)
    .single();

  if (submissionError || !submission) {
    console.error('Submission lookup error:', submissionError);
    return new Response(JSON.stringify({ error: 'Submission not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const opp = submission.opportunities;
  const vendor = submission.profiles;
  
  // Fetch all admins who want to receive submission notifications
  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .eq('receive_submission_notifications', true);

  const adminEmails = admins ? admins.map((a: { email: string }) => a.email) : [];
  
  // Combine any opportunity-specific emails with the global admin emails
  const emailsSet = new Set<string>([...(opp.notification_emails || []), ...adminEmails]);
  const emails = Array.from(emailsSet);

  if (emails.length === 0) {
    return new Response(JSON.stringify({ message: 'No notification emails configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const vendorDisplay = vendor.company ? `${vendor.full_name} (${vendor.company})` : vendor.full_name || vendor.email;

  // Build email HTML
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background-color: #0B1120; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="https://ship-pros-deal-room.vercel.app/SP_Logo.png" alt="Ship Pros" style="height: 36px; margin-bottom: 8px;" />
        <p style="color: #9CA3AF; margin: 4px 0 0; font-size: 14px;">New Vendor Submission</p>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #0B1120; margin: 0 0 16px; font-size: 18px;">New File Uploaded</h2>
        <p style="color: #6B7280; margin: 0 0 20px; font-size: 14px; line-height: 1.5;">
          <strong>${vendorDisplay}</strong> has submitted a new file for the opportunity "<strong>${opp.name}</strong>".
        </p>
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #6B7280;">File details:</p>
          <p style="margin: 0 0 4px; font-size: 14px;"><strong>Name:</strong> ${submission.file_name}</p>
          <p style="margin: 0; font-size: 14px;"><strong>Size:</strong> ${(submission.file_size / 1024).toFixed(1)} KB</p>
        </div>
        <div style="text-align: center;">
          <a href="${SITE_URL}/admin/opportunities/${submission.opportunity_id}" style="display: inline-block; background-color: #00BFA6; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">View Opportunity</a>
        </div>
      </div>
      <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">Ship Pros Deal Room</p>
    </div>
  `;

  // Download the attached file
  let attachments: any[] = [];
  if (submission.file_path && submission.file_name) {
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('opportunity-files')
        .download(submission.file_path);

      if (!downloadError && fileData) {
        const buffer = await fileData.arrayBuffer();
        const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
        const ext = submission.file_name.toLowerCase().split('.').pop() || '';
        const mimeTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'csv': 'text/csv',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'xls': 'application/vnd.ms-excel',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'txt': 'text/plain',
        };
        attachments = [{
          content: base64,
          filename: submission.file_name,
          type: mimeTypes[ext] || 'application/octet-stream',
          disposition: 'attachment',
        }];
      } else if (downloadError) {
        console.error('Download error:', downloadError);
      }
    } catch (err) {
      console.error('Failed to download file for attachment:', err);
    }
  }

  // Send to all notification emails
  const personalizations = emails.map((email: string) => ({ to: [{ email }] }));

  const emailPayload: any = {
    personalizations,
    from: { email: SENDER_EMAIL, name: 'Ship Pros Deal Room' },
    subject: `New Submission from ${vendorDisplay}: ${opp.name}`,
    content: [{ type: 'text/html', value: html }],
    tracking_settings: {
      click_tracking: {
        enable: false,
        enable_text: false
      }
    }
  };

  if (attachments.length > 0) {
    emailPayload.attachments = attachments;
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`SendGrid Error (${res.status}): ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true, sentTo: emails.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('SendGrid error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
