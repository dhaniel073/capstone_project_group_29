const mailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

// Create a transporter object using your email service credentials
const transporter = mailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Function to send an email using a template
const sendEmail = async (to, subject, templateName, templateData) => {
    try {
        // Render the EJS template with the provided data

        const templatePath = path.join(__dirname, '../EmailTemplates', `${templateName}.ejs`);
        const htmlContent = await ejs.renderFile(templatePath, templateData);

        // Define the email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html: htmlContent,
        };

        // Send the email
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
};

module.exports = sendEmail;