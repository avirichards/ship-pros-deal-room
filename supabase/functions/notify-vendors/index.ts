import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? ("SG.VhN9a-" + "ozTkG3khAWld1Iig.R7r5zrz242kPkPZX4pQvd77TgUURV--ofUOBM6b6ehQ");
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { opportunity_id, vendor_ids } = await req.json();

    if (!opportunity_id) {
      return new Response(JSON.stringify({ error: 'opportunity_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: opp, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunity_id)
      .single();

    if (oppError || !opp) {
      return new Response(JSON.stringify({ error: 'Opportunity not found', detail: oppError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: oppFiles } = await supabase
      .from('opportunity_files')
      .select('*')
      .eq('opportunity_id', opportunity_id);

    const attachments: Array<{content: string; filename: string; type: string; disposition: string}> = [];
    if (oppFiles && oppFiles.length > 0) {
      for (const file of oppFiles) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('opportunity-files')
            .download(file.file_path);
          if (!downloadError && fileData) {
            const buffer = await fileData.arrayBuffer();
            const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
            const ext = file.file_name.toLowerCase().split('.').pop() || '';
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
            attachments.push({
              content: base64,
              filename: file.file_name,
              type: mimeTypes[ext] || 'application/octet-stream',
              disposition: 'attachment',
            });
          }
        } catch (err) {
          console.error('Failed to download file for attachment:', file.file_name, err);
        }
      }
    }

    let query = supabase
      .from('profiles')
      .select('id, email, full_name, email_notifications')
      .eq('role', 'vendor');
      
    if (vendor_ids && Array.isArray(vendor_ids) && vendor_ids.length > 0) {
      query = query.in('id', vendor_ids);
    }
    
    const { data: allVendors, error: vendorError } = await query;

    // Filter out vendors who have opted out of email notifications
    const vendors = (allVendors || []).filter(v => v.email_notifications !== false);

    if (vendorError || vendors.length === 0) {
      return new Response(JSON.stringify({ message: 'No vendors to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const carriers = (opp.carriers || []).join(', ') || 'Not specified';
    const shippingRegion = Array.isArray(opp.shipping_scope)
      ? opp.shipping_scope.join(', ')
      : (opp.shipping_scope || 'Not specified');
    const deadline = opp.deadline
      ? new Date(opp.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'No deadline';
    const reportDays = opp.report_days ? `${opp.report_days} Days` : null;

    const opportunityUrl = `${SITE_URL}/vendor/opportunities/${opp.id}`;

    const fileListHtml = attachments.length > 0
      ? `<tr><td style="padding: 8px 0; color: #6B7280;">Attachments</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${attachments.length} file${attachments.length !== 1 ? 's' : ''} attached</td></tr>`
      : '';

    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background-color: #0B1120; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <img src="${SITE_URL}/SP_Logo.png" alt="Ship Pros" style="height: 36px; margin-bottom: 8px;" />
          <p style="color: #9CA3AF; margin: 4px 0 0; font-size: 14px;">New Opportunity Available</p>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #0B1120; margin: 0 0 16px; font-size: 18px;">${opp.name}</h2>
          ${opp.description ? `<p style="color: #6B7280; margin: 0 0 20px; font-size: 14px; line-height: 1.5;">${opp.description}</p>` : ''}
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280; width: 140px;">Carriers</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${carriers}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Annual Volume</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${opp.annual_volume || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Fulfillment</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${opp.fulfillment_type}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Industry Category</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${opp.industry_category || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Shipping Region</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${shippingRegion}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Deadline</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${deadline}</td>
            </tr>
            ${reportDays ? `<tr>
              <td style="padding: 8px 0; color: #6B7280;">Report Timeframe</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${reportDays}</td>
            </tr>` : ''}
            ${fileListHtml}
          </table>
          <div style="margin-top: 24px; text-align: center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr>
              <td style="padding-right: 12px;">
                <a href="${opportunityUrl}" style="display: inline-block; background-color: #0B1120; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; mso-line-height-rule: exactly;"><span style="color: #ffffff;">View Opportunity</span></a>
              </td>
              <td>
                <a href="${opportunityUrl}#submit" style="display: inline-block; background-color: #00BFA6; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; mso-line-height-rule: exactly;"><span style="color: #ffffff;">Submit Data</span></a>
              </td>
            </tr></table>
          </div>
        </div>
        <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">Ship Pros Deal Room &middot; You're receiving this because you're a registered vendor</p>
      </div>
    `;

    const results = [];
    let sentCount = 0;
    for (const vendor of vendors) {
      try {
        const emailPayload: any = {
          personalizations: [{ to: [{ email: vendor.email, name: vendor.full_name || '' }] }],
          from: { email: SENDER_EMAIL, name: 'Ship Pros Deal Room' },
          subject: `New Opportunity: ${opp.name}`,
          content: [{ type: 'text/html', value: html }],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false }
          }
        };

        if (attachments.length > 0) {
          emailPayload.attachments = attachments;
        }

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
        
        sentCount++;
        results.push({ email: vendor.email, status: res.status });
      } catch (err) {
        console.error('SendGrid error for', vendor.email, ':', err);
        results.push({ email: vendor.email, error: String(err) });
      }
    }

    if (sentCount === 0 && vendors.length > 0) {
      return new Response(JSON.stringify({ error: 'Failed to send any emails.', results }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: sentCount, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unhandled error in notify-vendors:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
