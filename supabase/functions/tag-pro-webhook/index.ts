import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { logRequest } from "../_shared/log.ts";
import {
  mailerooReferenceId,
  readMailerooError,
  readMailerooResponse,
  sendMailerooEmail,
} from "../_shared/maileroo.ts";

serve(async (req: Request) => {
  // Webhooks only come via POST from Stripe — no CORS needed
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const reqStart = Date.now();

  // ── Env guards ──────────────────────────────────────────────────────────────
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("tag-pro-webhook: STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    console.error("tag-pro-webhook: STRIPE_SECRET_KEY not configured");
    return new Response("Stripe key not configured", { status: 500 });
  }

  // ── Signature verification ──────────────────────────────────────────────────
  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    console.error("tag-pro-webhook: Invalid Stripe signature");
    return new Response("Invalid signature", { status: 400 });
  }

  // ── Parse event ─────────────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = JSON.parse(rawBody) as Stripe.Event;
  } catch (err) {
    console.error("tag-pro-webhook: Failed to parse event body", err);
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Service-role Supabase client ─────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Event handlers ───────────────────────────────────────────────────────────

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only handle Tag Pro subscriptions — skip other checkout sessions
    if (
      session.mode !== "subscription" || session.metadata?.product !== "tag-pro"
    ) {
      return new Response("OK", { status: 200 });
    }

    const userId = session.client_reference_id ?? session.metadata?.user_id;
    if (!userId) {
      console.error(
        "tag-pro-webhook: No user_id in checkout.session.completed",
      );
      return new Response("OK", { status: 200 });
    }

    const stripeCustomerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
    const stripeSubscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

    // Upsert tag_subscriptions row — dedup on stripe_session_id to handle Stripe retries
    const { error: subError } = await supabase
      .from("tag_subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_session_id: session.id,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_session_id", ignoreDuplicates: true },
      );

    if (subError) {
      // A2: return 500 so Stripe retries — upsert is idempotent, retries are safe
      logRequest({
        route: "tag-pro-webhook",
        status: "db_error",
        start: reqStart,
        event: event.type,
        error_code: subError.code ?? subError.message,
      });
      return new Response(
        JSON.stringify({ error: "internal_db_failure", retry: true }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Upgrade profile tier to 'pro'
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ tier: "pro" })
      .eq("id", userId);

    if (profileError) {
      // A2: return 500 so Stripe retries — profile update is idempotent
      logRequest({
        route: "tag-pro-webhook",
        status: "db_error",
        start: reqStart,
        event: event.type,
        error_code: profileError.code ?? profileError.message,
      });
      return new Response(
        JSON.stringify({ error: "internal_db_failure", retry: true }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`tag-pro-webhook: User ${userId} upgraded to pro`);

    // Send the welcome email without ever rolling back the tier update.
    try {
      const mailerooKey = Deno.env.get("MAILEROO_API_KEY");
      const { data: userData, error: userError } = await supabase.auth.admin
        .getUserById(userId);
      if (userError || !userData?.user?.email) {
        console.error(
          "tag-pro-webhook: Could not fetch user email for welcome",
          userError,
        );
      } else {
        const toEmail = userData.user.email;
        const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Tag Pro</title>
  <style>
    body { margin: 0; padding: 0; background: #FAF8F5; font-family: 'Space Grotesk', Arial, sans-serif; color: #1a1a1a; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e8e3dc; overflow: hidden; }
    .header { background: #8B7DA8; padding: 32px 40px 24px; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .header .crown { font-size: 22px; margin-bottom: 8px; }
    .body { padding: 32px 40px; }
    .body p { font-size: 15px; line-height: 1.65; color: #3a3530; margin: 0 0 20px; }
    .body ul { padding-left: 20px; margin: 0 0 20px; }
    .body ul li { font-size: 15px; line-height: 1.65; color: #3a3530; margin-bottom: 6px; }
    .cta { display: inline-block; margin: 8px 0 24px; background: #8B7DA8; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-size: 14px; font-weight: 600; }
    .signoff { font-size: 14px; color: #6b6360; border-top: 1px solid #e8e3dc; padding-top: 20px; margin-top: 8px; }
    .signoff a { color: #8B7DA8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="crown">👑</div>
      <h1>Welcome to Tag Pro</h1>
    </div>
    <div class="body">
      <p>Your $7 just unlocked the good models.</p>
      <ul>
        <li><strong>Kimi-K2.6, GLM-5.1, MiniMax-M2.5, and Nemotron</strong>: the premium fleet is yours.</li>
        <li><strong>Multi-model compare</strong>: run the same prompt side-by-side across models.</li>
        <li><strong>100 premium messages/day</strong>: no more throttle when you bring your own keys.</li>
        <li><strong>Memory</strong>: context that follows you across sessions.</li>
        <li><strong>File uploads</strong>: drop in a doc and chat with it.</li>
      </ul>
      <p>The model picker is in the top bar. Premium models are marked. Just select one and go.</p>
      <a class="cta" href="https://hecz.dev/chat">Open Tag &rarr;</a>
      <div class="signoff">
        <p>JR. Tag is open source at <a href="https://github.com/TooFaded420/tag">github.com/TooFaded420/tag</a> if you want to fork it or self-host.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        const textBody = `Welcome to Tag Pro

Your $7 just unlocked the good models.

- Kimi-K2.6, GLM-5.1, MiniMax-M2.5, and Nemotron: the premium fleet is yours.
- Multi-model compare: run the same prompt side-by-side across models.
- 100 premium messages/day: no throttle when you bring your own keys.
- Memory: context that follows you across sessions.
- File uploads: drop in a doc and chat with it.

Open chat at https://hecz.dev/chat. The model picker is in the top bar.

JR. Tag is open source at https://github.com/TooFaded420/tag if you want to fork it or self-host.`;

        const subject =
          "Welcome to Tag Pro: your $7 just unlocked the good models";
        const campaignKey = `tag-pro-welcome:${session.id}`;
        const { error: campaignSeedError } = await supabase.from(
          "email_campaigns",
        ).upsert({
          campaign_key: campaignKey,
          kind: "transactional",
          name: "Tag Pro welcome",
          subject,
          audience_tag: "tag-pro",
          provider_configured: Boolean(mailerooKey),
          status: "queued",
        }, { onConflict: "campaign_key", ignoreDuplicates: true });
        if (campaignSeedError) {
          throw new Error("Tag Pro email campaign initialization failed");
        }

        const { data: campaign, error: campaignError } = await supabase
          .from("email_campaigns")
          .select("id")
          .eq("campaign_key", campaignKey)
          .single();
        if (campaignError || !campaign) {
          throw new Error("Tag Pro email campaign lookup failed");
        }
        const { error: providerStateError } = await supabase
          .from("email_campaigns")
          .update({ provider_configured: Boolean(mailerooKey) })
          .eq("id", campaign.id);
        if (providerStateError) {
          throw new Error("Tag Pro provider state update failed");
        }

        const { error: deliverySeedError } = await supabase.from(
          "email_deliveries",
        ).upsert({
          campaign_id: campaign.id,
          recipient_email: toEmail,
        }, {
          onConflict: "campaign_id,recipient_email",
          ignoreDuplicates: true,
        });
        if (deliverySeedError) {
          throw new Error("Tag Pro delivery initialization failed");
        }

        const { data: delivery, error: deliveryError } = await supabase
          .from("email_deliveries")
          .select("id, provider_email_id")
          .eq("campaign_id", campaign.id)
          .eq("recipient_email", toEmail)
          .single();
        if (deliveryError || !delivery) {
          throw new Error("Tag Pro delivery lookup failed");
        }

        if (!mailerooKey) {
          console.error(
            "tag-pro-webhook: MAILEROO_API_KEY not configured, welcome email remains queued",
          );
        } else if (!delivery.provider_email_id) {
          const { data: claimed, error: claimError } = await supabase.rpc(
            "claim_email_delivery",
            {
              p_delivery_id: delivery.id,
            },
          );
          if (claimError) throw new Error("Tag Pro delivery claim failed");

          if (claimed) {
            let emailResponse: Response | null = null;
            try {
              emailResponse = await sendMailerooEmail(mailerooKey, {
                from: { address: "hello@hecz.dev", display_name: "Tag" },
                to: { address: toEmail },
                reply_to: { address: "hector@hecz.dev", display_name: "JR" },
                subject,
                html: htmlBody,
                plain: textBody,
                tracking: true,
                tags: {
                  campaign_id: campaign.id,
                  delivery_id: delivery.id,
                  category: "tag_pro_welcome",
                },
                reference_id: mailerooReferenceId(delivery.id),
              });
            } catch {
              emailResponse = null;
            }

            if (emailResponse?.ok) {
              const result = await readMailerooResponse(emailResponse);
              if (!result.data?.reference_id) {
                const occurredAt = new Date().toISOString();
                await supabase.from("email_deliveries").update({
                  status: "unknown",
                  failed_at: occurredAt,
                  last_event_at: occurredAt,
                  error_code: "missing_provider_id",
                  error_message: "Maileroo returned no reference id",
                }).eq("id", delivery.id).is("provider_email_id", null);
                throw new Error("Maileroo returned no reference id");
              }
              const acceptedAt = new Date().toISOString();
              const { data: persisted, error: acceptanceError } = await supabase
                .rpc(
                  "record_email_acceptances",
                  {
                    p_acceptances: [{
                      delivery_id: delivery.id,
                      provider_email_id: result.data.reference_id,
                      accepted_at: acceptedAt,
                    }],
                  },
                );
              if (acceptanceError || persisted !== 1) {
                const occurredAt = new Date().toISOString();
                await supabase.from("email_deliveries").update({
                  status: "unknown",
                  failed_at: occurredAt,
                  last_event_at: occurredAt,
                  error_code: "acceptance_persistence_failed",
                  error_message:
                    "Maileroo accepted the email but local persistence failed",
                }).eq("id", delivery.id).is("provider_email_id", null);
                throw new Error(
                  "Tag Pro delivery acceptance persistence failed",
                );
              }
              console.log(
                `tag-pro-webhook: Welcome email accepted for ${toEmail}`,
              );
            } else {
              const occurredAt = new Date().toISOString();
              const status = emailResponse?.status === 429
                ? "queued"
                : !emailResponse || emailResponse.status >= 500
                ? "unknown"
                : "failed";
              const errorMessage = emailResponse
                ? await readMailerooError(emailResponse)
                : "Maileroo request outcome is unknown";
              const { error: sendError } = await supabase.from(
                "email_deliveries",
              ).update({
                status,
                failed_at: status === "queued" ? null : occurredAt,
                last_event_at: occurredAt,
                error_code: `maileroo_${emailResponse?.status ?? "network"}`,
                error_message: errorMessage,
              }).eq("id", delivery.id).is("provider_email_id", null);
              if (sendError) {
                throw new Error("Tag Pro delivery failure persistence failed");
              }
            }
          }
        }

        const { error: rollupError } = await supabase.rpc(
          "refresh_email_campaign_rollup",
          {
            p_campaign_id: campaign.id,
            p_finalize: false,
            p_provider_hourly_limit: Number.parseInt(
              Deno.env.get("MAILEROO_HOURLY_LIMIT") ?? "",
              10,
            ) || undefined,
            p_provider_monthly_limit: Number.parseInt(
              Deno.env.get("MAILEROO_MONTHLY_LIMIT") ?? "",
              10,
            ) || undefined,
          },
        );
        if (rollupError) throw new Error("Tag Pro campaign rollup failed");
      }
    } catch (emailErr) {
      // Email failure must never roll back the tier upgrade
      console.error(
        "tag-pro-webhook: Unexpected error sending welcome email:",
        emailErr,
      );
    }
  } else if (
    event.type === "customer.subscription.deleted" ||
    (event.type === "customer.subscription.updated" &&
      ["canceled", "unpaid", "past_due"].includes(
        (event.data.object as Stripe.Subscription).status,
      ))
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const stripeSubscriptionId = subscription.id;

    // Look up user_id from tag_subscriptions
    const { data: subRow, error: lookupError } = await supabase
      .from("tag_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "tag-pro-webhook: Failed to look up subscription:",
        lookupError,
      );
      return new Response(JSON.stringify({ error: lookupError.message }), {
        status: 500,
      });
    }

    if (!subRow) {
      // Unknown subscription — not ours, silently ack
      console.log(
        `tag-pro-webhook: Unknown subscription ${stripeSubscriptionId}, skipping`,
      );
      return new Response("OK", { status: 200 });
    }

    const userId = subRow.user_id;

    // Update tag_subscriptions status (idempotent)
    await supabase
      .from("tag_subscriptions")
      .update({
        status: subscription.status as string,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", stripeSubscriptionId);

    // Downgrade profile tier to 'free'
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ tier: "free" })
      .eq("id", userId);

    if (profileError) {
      console.error(
        "tag-pro-webhook: Failed to downgrade profile tier:",
        profileError,
      );
    } else {
      console.log(
        `tag-pro-webhook: User ${userId} downgraded to free (sub status: ${subscription.status})`,
      );
    }
  }

  logRequest({
    route: "tag-pro-webhook",
    status: "ok",
    start: reqStart,
    event: event.type,
  });
  return new Response("OK", { status: 200 });
});
