// // src/services/emailService.js
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// // Создаем транспортер
// const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: parseInt(process.env.EMAIL_PORT) || 465,
//     secure: true,
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASSWORD
//     },
//     tls: {
//         rejectUnauthorized: false // Для локального тестирования
//     }
// });

// /**
//  * Отправляет email с оповещением о критических угрозах
//  * @param {Object} options - Опции email
//  * @param {string} options.to - Получатель
//  * @param {string} options.subject - Тема письма
//  * @param {string} options.text - Текст письма (plain text)
//  * @param {string} options.html - HTML версия письма
//  * @returns {Promise<boolean>} - Успешно ли отправлено
//  */
// async function sendEmail({ to, subject, text, html }) {
//     try {
//         const mailOptions = {
//             from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
//             to: to || process.env.EMAIL_TO,
//             subject: subject || 'Security Alert',
//             text: text,
//             html: html
//         };

//         const info = await transporter.sendMail(mailOptions);
//         console.log(`Email sent: ${info.messageId}`);
//         return true;
//     } catch (error) {
//         console.error('Email sending failed:', error);
//         return false;
//     }
// }

// /**
//  * Формирует и отправляет оповещение о критических угрозах в проекте
//  * @param {string} projectName - Название проекта
//  * @param {number} projectId - ID проекта
//  * @param {Array} criticalResults - Результаты с критическими угрозами
//  * @param {string} scanType - Тип сканирования ('single' или 'full')
//  * @returns {Promise<boolean>}
//  */
// async function sendCriticalAlert(projectName, projectId, criticalResults, scanType = 'single') {
//     const criticalCount = criticalResults.length;
    
//     let subject, text, html;
    
//     if (scanType === 'single') {
//         subject = `🔴 КРИТИЧЕСКАЯ УГРОЗА: ${projectName}`;
//         text = `В проекте "${projectName}" (ID: ${projectId}) обнаружено ${criticalCount} критических угроз!\n\n`;
//         text += 'Критические уязвимости:\n';
//         criticalResults.forEach((result, index) => {
//             text += `${index + 1}. ${result.item}\n`;
//             text += `   Детали: ${result.details}\n\n`;
//         });
        
//         html = `
//             <h2 style="color: #e74c3c;">🔴 КРИТИЧЕСКАЯ УГРОЗА: ${projectName}</h2>
//             <p>В проекте <strong>${projectName}</strong> (ID: ${projectId}) обнаружено <strong>${criticalCount}</strong> критических угроз!</p>
//             <h3>Критические уязвимости:</h3>
//             <ul>
//             ${criticalResults.map(result => `
//                 <li>
//                     <strong>${result.item}</strong><br>
//                     <small>${result.details}</small>
//                 </li>
//             `).join('')}
//             </ul>
//             <p><em>Система мониторинга безопасности CI/CD</em></p>
//         `;
//     } else {
//         // Для полного сканирования (multiple projects)
//         subject = `📊 Отчет о критических угрозах в ${criticalCount} проектах`;
//         text = `В ходе полного сканирования обнаружены критические угрозы в ${criticalCount} проектах:\n\n`;
//         criticalResults.forEach(item => {
//             text += `- ${item.projectName} (ID: ${item.projectId}): ${item.criticalCount} критических угроз\n`;
//         });
        
//         html = `
//             <h2 style="color: #e67e22;">📊 Отчет о критических угрозах</h2>
//             <p>В ходе полного сканирования обнаружены критические угрозы в <strong>${criticalCount}</strong> проектах:</p>
//             <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
//                 <thead>
//                     <tr style="background-color: #f2f2f2;">
//                         <th>Проект</th>
//                         <th>ID</th>
//                         <th>Критических угроз</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     ${criticalResults.map(item => `
//                         <tr>
//                             <td><strong>${item.projectName}</strong></td>
//                             <td>${item.projectId}</td>
//                             <td style="color: #e74c3c; text-align: center;"><strong>${item.criticalCount}</strong></td>
//                         </tr>
//                     `).join('')}
//                 </tbody>
//             </table>
//             <p><em>Система мониторинга безопасности CI/CD</em></p>
//         `;
//     }
    
//     return await sendEmail({
//         subject,
//         text,
//         html
//     });
// }

// module.exports = {
//     sendEmail,
//     sendCriticalAlert
// };

// src/services/emailService.js
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// class EmailService {
//     constructor() {
//         if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
//             console.warn('Email configuration is missing. Email notifications will be disabled.');
//             this.transporter = null;
//             return;
//         }

//         this.transporter = nodemailer.createTransport({
//             host: process.env.EMAIL_HOST,
//             port: process.env.EMAIL_PORT || 465,
//             secure: true, // true для порта 465, false для других портов
//             auth: {
//                 user: process.env.EMAIL_USER,
//                 pass: process.env.EMAIL_PASSWORD
//             }
//         });

//         this.from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
//         this.to = process.env.EMAIL_TO || process.env.EMAIL_USER;
//     }

//     async sendEmail(subject, html) {
//         if (!this.transporter) {
//             console.log('Email service disabled. Would send:', subject);
//             return false;
//         }

//         try {
//             const info = await this.transporter.sendMail({
//                 from: `"Security Monitor CI/CD" <${this.from}>`,
//                 to: this.to,
//                 subject: subject,
//                 html: html
//             });

//             console.log(`Email sent: ${info.messageId}`);
//             return true;
//         } catch (error) {
//             console.error('Error sending email:', error);
//             return false;
//         }
//     }

//     /**
//      * Отправка уведомления после полного сканирования
//      */
//     async sendFullScanNotification(scanResults) {
//         const totalCritical = scanResults.reduce((sum, project) => sum + (project.criticalCount || 0), 0);
//         const totalProjects = scanResults.length;
//         const projectsWithCritical = scanResults.filter(p => p.criticalCount > 0).length;

//         const subject = `[Security Monitor] Полное сканирование завершено: ${totalCritical} критических угроз`;

//         let html = `
//             <!DOCTYPE html>
//             <html>
//             <head>
//                 <style>
//                     body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//                     .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//                     .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
//                     .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
//                     .stats { display: flex; justify-content: space-between; margin: 20px 0; }
//                     .stat-card { background: white; padding: 15px; border-radius: 6px; text-align: center; flex: 1; margin: 0 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
//                     .stat-number { font-size: 24px; font-weight: bold; }
//                     .critical { color: #e74c3c; }
//                     .high { color: #e67e22; }
//                     .medium { color: #f39c12; }
//                     .low { color: #3498db; }
//                     .project-list { margin-top: 20px; }
//                     .project-item { background: white; padding: 10px; margin: 5px 0; border-left: 4px solid #3498db; border-radius: 4px; }
//                     .project-item.critical { border-left-color: #e74c3c; }
//                     .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
//                 </style>
//             </head>
//             <body>
//                 <div class="container">
//                     <div class="header">
//                         <h1>🛡️ Security Monitor CI/CD</h1>
//                         <p>Результаты полного сканирования безопасности</p>
//                     </div>
//                     <div class="content">
//                         <div class="stats">
//                             <div class="stat-card">
//                                 <div class="stat-number">${totalProjects}</div>
//                                 <div>Всего проектов</div>
//                             </div>
//                             <div class="stat-card critical">
//                                 <div class="stat-number">${totalCritical}</div>
//                                 <div>Критических угроз</div>
//                             </div>
//                             <div class="stat-card">
//                                 <div class="stat-number">${projectsWithCritical}</div>
//                                 <div>Проектов с угрозами</div>
//                             </div>
//                         </div>

//                         <h3>📊 Общая статистика угроз:</h3>
//                         <ul>
//                             <li><span class="critical">Критические: ${totalCritical}</span></li>
//                             <li><span class="high">Высокие: ${scanResults.reduce((sum, p) => sum + (p.highCount || 0), 0)}</span></li>
//                             <li><span class="medium">Средние: ${scanResults.reduce((sum, p) => sum + (p.mediumCount || 0), 0)}</span></li>
//                             <li><span class="low">Низкие: ${scanResults.reduce((sum, p) => sum + (p.lowCount || 0), 0)}</span></li>
//                         </ul>

//                         ${projectsWithCritical > 0 ? `
//                         <div class="project-list">
//                             <h3>🚨 Проекты с критическими угрозами:</h3>
//                             ${scanResults.filter(p => p.criticalCount > 0).map(project => `
//                                 <div class="project-item ${project.criticalCount > 0 ? 'critical' : ''}">
//                                     <strong>${project.name}</strong><br>
//                                     Критических: ${project.criticalCount} | Высоких: ${project.highCount || 0}<br>
//                                     ID: ${project.id} | GitLab ID: ${project.gitlabProjectId}
//                                 </div>
//                             `).join('')}
//                         </div>
//                         ` : '<p>✅ Критических угроз не обнаружено</p>'}

//                         <div class="footer">
//                             <p>Сканирование выполнено: ${new Date().toLocaleString('ru-RU')}</p>
//                             <p>Система мониторинга безопасности CI/CD</p>
//                         </div>
//                     </div>
//                 </div>
//             </body>
//             </html>
//         `;

//         return this.sendEmail(subject, html);
//     }

//     /**
//      * Отправка уведомления после сканирования одного проекта
//      */
//     async sendProjectScanNotification(project, scanResult) {
//         const criticalCount = scanResult.summary?.critical || 0;
//         const highCount = scanResult.summary?.high || 0;
//         const totalRisks = scanResult.summary?.totalRisks || 0;

//         let status = '✅ Успешно';
//         let statusClass = 'success';
        
//         if (criticalCount > 0) {
//             status = '🚨 Критически';
//             statusClass = 'critical';
//         } else if (highCount > 0) {
//             status = '⚠️ Требует внимания';
//             statusClass = 'warning';
//         }

//         const subject = `[Security Monitor] Сканирование проекта "${project.name}": ${criticalCount} критических угроз`;

//         let html = `
//             <!DOCTYPE html>
//             <html>
//             <head>
//                 <style>
//                     body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//                     .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//                     .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
//                     .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
//                     .project-info { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
//                     .status { font-size: 18px; font-weight: bold; padding: 10px; border-radius: 6px; text-align: center; }
//                     .status.critical { background: #ffeaea; color: #e74c3c; border: 2px solid #e74c3c; }
//                     .status.warning { background: #fff4e6; color: #e67e22; border: 2px solid #e67e22; }
//                     .status.success { background: #e8f6f3; color: #27ae60; border: 2px solid #27ae60; }
//                     .stats { display: flex; justify-content: space-between; margin: 20px 0; }
//                     .stat-card { background: white; padding: 15px; border-radius: 6px; text-align: center; flex: 1; margin: 0 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
//                     .stat-number { font-size: 24px; font-weight: bold; }
//                     .critical { color: #e74c3c; }
//                     .high { color: #e67e22; }
//                     .medium { color: #f39c12; }
//                     .low { color: #3498db; }
//                     .check-list { margin-top: 20px; }
//                     .check-item { background: white; padding: 10px; margin: 5px 0; border-left: 4px solid #3498db; border-radius: 4px; }
//                     .check-item.critical { border-left-color: #e74c3c; }
//                     .check-item.high { border-left-color: #e67e22; }
//                     .check-item.medium { border-left-color: #f39c12; }
//                     .check-item.low { border-left-color: #3498db; }
//                     .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
//                     .actions { margin-top: 20px; text-align: center; }
//                     .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 0 10px; }
//                 </style>
//             </head>
//             <body>
//                 <div class="container">
//                     <div class="header">
//                         <h1>🛡️ Security Monitor CI/CD</h1>
//                         <p>Результаты сканирования проекта</p>
//                     </div>
//                     <div class="content">
//                         <div class="project-info">
//                             <h2>${project.name}</h2>
//                             <p>ID: ${project.id} | GitLab ID: ${project.gitlabProjectId}</p>
//                             <p>URL: <a href="${project.url}">${project.url}</a></p>
//                         </div>

//                         <div class="status ${statusClass}">
//                             ${status}
//                         </div>

//                         <div class="stats">
//                             <div class="stat-card critical">
//                                 <div class="stat-number">${criticalCount}</div>
//                                 <div>Критических</div>
//                             </div>
//                             <div class="stat-card high">
//                                 <div class="stat-number">${highCount}</div>
//                                 <div>Высоких</div>
//                             </div>
//                             <div class="stat-card">
//                                 <div class="stat-number">${totalRisks}</div>
//                                 <div>Всего угроз</div>
//                             </div>
//                         </div>

//                         ${criticalCount > 0 ? `
//                         <div class="check-list">
//                             <h3>🔍 Найденные критические уязвимости:</h3>
//                             ${scanResult.results?.flatMap(check => 
//                                 check.results?.filter(result => 
//                                     result.severity === 'critical' || result.status === 'FAIL'
//                                 ).map(result => `
//                                     <div class="check-item critical">
//                                         <strong>${check.name || check.id}</strong><br>
//                                         ${result.item}: ${result.details?.substring(0, 100)}${result.details?.length > 100 ? '...' : ''}
//                                     </div>
//                                 `)
//                             ).filter(Boolean).join('') || '<p>Нет подробной информации</p>'}
//                         </div>
//                         ` : ''}

//                         <div class="actions">
//                             <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/projects/${project.id}" class="btn">
//                                 📊 Открыть детальный отчет
//                             </a>
//                         </div>

//                         <div class="footer">
//                             <p>Сканирование выполнено: ${new Date().toLocaleString('ru-RU')}</p>
//                             <p>Система мониторинга безопасности CI/CD</p>
//                         </div>
//                     </div>
//                 </div>
//             </body>
//             </html>
//         `;

//         return this.sendEmail(subject, html);
//     }
// }

// module.exports = new EmailService();

// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Создаем транспортер для Mail.ru
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.mail.ru',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: true, // true для порта 465, false для других портов
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Отправляет email уведомление о сканировании
 * @param {Object} options - Параметры письма
 * @param {string} options.subject - Тема письма
 * @param {string} options.html - HTML содержимое письма
 * @param {string} options.text - Текстовое содержимое письма
 * @returns {Promise<boolean>} Успешно ли отправлено
 */
async function sendEmail(options) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]*>/g, '')
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Email отправлен: ${options.subject}`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error.message);
        return false;
    }
}

/**
 * Отправляет уведомление о полном сканировании
 * @param {Array} projects - Массив проектов с информацией о рисках
 * @param {Object} scanSummary - Сводка сканирования
 * @returns {Promise<boolean>}
 */
async function sendFullScanNotification(projects, scanSummary) {
    const criticalProjects = projects.filter(p => 
        p.latestScanSummary?.critical > 0 || p.scans?.[0]?.summary?.critical > 0
    );

    const totalCritical = criticalProjects.reduce((sum, p) => {
        const critical = p.latestScanSummary?.critical || p.scans?.[0]?.summary?.critical || 0;
        return sum + critical;
    }, 0);

    const subject = `[Security Monitor] Полное сканирование завершено: ${totalCritical} критических угроз`;

    let html = `
        <h2>Результаты полного сканирования CI/CD безопасности</h2>
        <p><strong>Общее количество проектов:</strong> ${projects.length}</p>
        <p><strong>Проектов с критическими угрозами:</strong> ${criticalProjects.length}</p>
        <p><strong>Всего критических угроз:</strong> ${totalCritical}</p>
    `;

    if (criticalProjects.length > 0) {
        html += `<h3>Проекты с критическими угрозами:</h3><ul>`;
        
        criticalProjects.forEach(project => {
            const critical = project.latestScanSummary?.critical || project.scans?.[0]?.summary?.critical || 0;
            const name = project.name || `Проект ${project.gitLabProjectId}`;
            html += `<li><strong>${name}</strong>: ${critical} критических угроз</li>`;
        });
        
        html += `</ul>`;
    } else {
        html += `<p><strong>✅ Критических угроз не обнаружено!</strong></p>`;
    }

    html += `
        <p><em>Сканирование выполнено: ${new Date().toLocaleString('ru-RU')}</em></p>
        <p>---</p>
        <p><small>Система мониторинга безопасности CI/CD</small></p>
    `;

    return await sendEmail({
        subject,
        html
    });
}

/**
 * Отправляет уведомление о сканировании одного проекта
 * @param {Object} project - Проект с информацией о рисках
 * @param {Object} scanResult - Результат сканирования
 * @returns {Promise<boolean>}
 */
async function sendSingleProjectNotification(project, scanResult) {
    const critical = scanResult.summary?.critical || 0;
    const projectName = project.name || `Проект ${project.gitLabProjectId}`;

    const subject = `[Security Monitor] Сканирование проекта "${projectName}": ${critical} критических угроз`;

    let html = `
        <h2>Результаты сканирования проекта</h2>
        <p><strong>Проект:</strong> ${projectName}</p>
        <p><strong>GitLab ID:</strong> ${project.gitLabProjectId}</p>
        <p><strong>Критических угроз:</strong> ${critical}</p>
        <p><strong>Всего рисков:</strong> ${scanResult.summary?.totalRisks || 0}</p>
    `;

    if (critical > 0) {
        html += `<h3>🔴 Обнаружены критические угрозы!</h3>`;
        
        // Добавляем детали критических проверок
        const criticalChecks = scanResult.results?.filter(check => 
            check.results?.some(r => r.severity?.toLowerCase() === 'critical')
        ) || [];

        if (criticalChecks.length > 0) {
            html += `<h4>Критические проверки:</h4><ul>`;
            criticalChecks.forEach(check => {
                const criticalItems = check.results.filter(r => 
                    r.severity?.toLowerCase() === 'critical'
                );
                html += `<li><strong>${check.name}</strong>: ${criticalItems.length} критических проблем</li>`;
            });
            html += `</ul>`;
        }
    } else {
        html += `<p><strong>✅ Критических угроз не обнаружено!</strong></p>`;
    }

    html += `
        <p><em>Сканирование выполнено: ${new Date().toLocaleString('ru-RU')}</em></p>
        <p>---</p>
        <p><small>Система мониторинга безопасности CI/CD</small></p>
    `;

    return await sendEmail({
        subject,
        html
    });
}

module.exports = {
    sendEmail,
    sendFullScanNotification,
    sendSingleProjectNotification,
    transporter
};