// src/routes/api/send-email/+server.js
import { json } from '@sveltejs/kit';
import sgMail from '@sendgrid/mail';
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME } from '$env/static/private';

// Set SendGrid API key
sgMail.setApiKey(SENDGRID_API_KEY);

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { to, subject, html, type, batch } = body;

        // Handle batch emails
        if (batch && Array.isArray(batch)) {
            if (batch.length === 0) {
                return json(
                    { error: 'Batch array is empty' },
                    { status: 400 }
                );
            }

            if (!subject || !html) {
                return json(
                    { error: 'Missing required fields: subject or html for batch email' },
                    { status: 400 }
                );
            }

            const messages = batch.map(recipient => {
                let personalizedHtml = html;
                if (recipient.name) {
                    personalizedHtml = personalizedHtml.replace(/\[Name\]/g, recipient.name);
                }

                return {
                    to: recipient.email,
                    from: {
                        email: SENDGRID_FROM_EMAIL,
                        name: SENDGRID_FROM_NAME || 'Grønbech Revision',
                    },
                    subject: subject,
                    html: personalizedHtml,
                };
            });

            try {
                await sgMail.send(messages);
                return json({ 
                    success: true, 
                    message: `${messages.length} emails sent successfully` 
                });
            } catch (error) {
                console.error('SendGrid batch error:', error);
                return json(
                    { error: `SendGrid error: ${error.message}` },
                    { status: 500 }
                );
            }
        }

        // Handle single email
        if (!to || !subject || !html) {
            return json(
                { error: 'Missing required fields: to, subject, or html' },
                { status: 400 }
            );
        }

        const msg = {
            to: to,
            from: {
                email: SENDGRID_FROM_EMAIL,
                name: 'Grønbech Revision'  // <-- Add your company name here
            },
            subject: subject,
            html: html,
        };

        try {
            await sgMail.send(msg);
            return json({ 
                success: true, 
                message: 'Email sent successfully' 
            });
        } catch (error) {
            console.error('SendGrid error:', error);
            return json(
                { error: `SendGrid error: ${error.message}` },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Server error:', error);
        return json(
            { error: `Internal server error: ${error.message}` },
            { status: 500 }
        );
    }
}