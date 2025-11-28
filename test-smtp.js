import transporter from './mailer.js';

console.log('Testing SMTP Connection...');
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Error:', error);
    } else {
        console.log('SMTP Ready! Connection successful.');
    }
});
