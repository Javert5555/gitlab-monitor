// src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Создаем транспортер
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false // Для локального тестирования
    }
});

/**
 * Отправляет email с оповещением о критических угрозах
 * @param {Object} options - Опции email
 * @param {string} options.to - Получатель
 * @param {string} options.subject - Тема письма
 * @param {string} options.text - Текст письма (plain text)
 * @param {string} options.html - HTML версия письма
 * @returns {Promise<boolean>} - Успешно ли отправлено
 */
async function sendEmail({ to, subject, text, html }) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to || process.env.EMAIL_TO,
            subject: subject || 'Security Alert',
            text: text,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
}

/**
 * Формирует и отправляет оповещение о критических угрозах в проекте
 * @param {string} projectName - Название проекта
 * @param {number} projectId - ID проекта
 * @param {Array} criticalResults - Результаты с критическими угрозами
 * @param {string} scanType - Тип сканирования ('single' или 'full')
 * @returns {Promise<boolean>}
 */
async function sendCriticalAlert(projectName, projectId, criticalResults, scanType = 'single') {
    const criticalCount = criticalResults.length;
    
    let subject, text, html;
    
    if (scanType === 'single') {
        subject = `🔴 КРИТИЧЕСКАЯ УГРОЗА: ${projectName}`;
        text = `В проекте "${projectName}" (ID: ${projectId}) обнаружено ${criticalCount} критических угроз!\n\n`;
        text += 'Критические уязвимости:\n';
        criticalResults.forEach((result, index) => {
            text += `${index + 1}. ${result.item}\n`;
            text += `   Детали: ${result.details}\n\n`;
        });
        
        html = `
            <h2 style="color: #e74c3c;">🔴 КРИТИЧЕСКАЯ УГРОЗА: ${projectName}</h2>
            <p>В проекте <strong>${projectName}</strong> (ID: ${projectId}) обнаружено <strong>${criticalCount}</strong> критических угроз!</p>
            <h3>Критические уязвимости:</h3>
            <ul>
            ${criticalResults.map(result => `
                <li>
                    <strong>${result.item}</strong><br>
                    <small>${result.details}</small>
                </li>
            `).join('')}
            </ul>
            <p><em>Система мониторинга безопасности CI/CD</em></p>
        `;
    } else {
        // Для полного сканирования (multiple projects)
        subject = `📊 Отчет о критических угрозах в ${criticalCount} проектах`;
        text = `В ходе полного сканирования обнаружены критические угрозы в ${criticalCount} проектах:\n\n`;
        criticalResults.forEach(item => {
            text += `- ${item.projectName} (ID: ${item.projectId}): ${item.criticalCount} критических угроз\n`;
        });
        
        html = `
            <h2 style="color: #e67e22;">📊 Отчет о критических угрозах</h2>
            <p>В ходе полного сканирования обнаружены критические угрозы в <strong>${criticalCount}</strong> проектах:</p>
            <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th>Проект</th>
                        <th>ID</th>
                        <th>Критических угроз</th>
                    </tr>
                </thead>
                <tbody>
                    ${criticalResults.map(item => `
                        <tr>
                            <td><strong>${item.projectName}</strong></td>
                            <td>${item.projectId}</td>
                            <td style="color: #e74c3c; text-align: center;"><strong>${item.criticalCount}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p><em>Система мониторинга безопасности CI/CD</em></p>
        `;
    }
    
    return await sendEmail({
        subject,
        text,
        html
    });
}

module.exports = {
    sendEmail,
    sendCriticalAlert
};