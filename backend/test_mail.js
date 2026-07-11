require('dotenv').config();
const nodemailer = require('nodemailer');

// Điền trực tiếp cấu hình của bạn vào đây để test nhanh tại local máy
const EMAIL_USER = 'toiyeutinhoc238@gmail.com'; // Gmail của bạn (hoặc gmail điền trên Render)
const EMAIL_PASS = 'xsgiyroaxroaczgd'; // Mã 16 ký tự vừa tạo

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

async function runTest() {
    console.log('Đang kết nối SMTP Gmail...');
    try {
        await transporter.verify();
        console.log('✅ Kết nối SMTP thành công!');
        
        console.log('Đang gửi mail test...');
        const info = await transporter.sendMail({
            from: `"UPMath Test" <${EMAIL_USER}>`,
            to: EMAIL_USER, // Gửi thử cho chính mình
            subject: 'Test gửi thư UPMath',
            html: '<h3>Kết nối gửi thư từ Node.js thành công 100%!</h3>'
        });
        console.log('✅ Gửi thư thành công! MessageId:', info.messageId);
    } catch (err) {
        console.error('❌ Lỗi kết nối hoặc gửi thư:', err.message);
    }
}

runTest();
