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
        console.log(`Email отправлен: ${options.subject}`);
        return true;
    } catch (error) {
        console.error('Ошибка отправки email:', error.message);
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
    console.log(projects)
    
    // Подсчитываем ВСЕ риски по всем проектам
    let totalCritical = 0;
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;
    let totalRisks = 0;
    
    const projectsWithRisks = [];

    projects.forEach(p => {
        const scan = p.latestScanSummary || p.scans?.[0]?.summary;
        if (scan) {
            const critical = scan.critical || 0;
            const high = scan.high || 0;
            const medium = scan.medium || 0;
            const low = scan.low || 0;
            const projectTotal = scan.totalRisks || 0;
            
            totalCritical += critical;
            totalHigh += high;
            totalMedium += medium;
            totalLow += low;
            totalRisks += projectTotal;
            
            if (projectTotal > 0) {
                projectsWithRisks.push({
                    name: p.name || `Проект ${p.gitLabProjectId}`,
                    critical,
                    high,
                    medium,
                    low,
                    total: projectTotal
                });
            }
        }
    });

    const subject = `[Security Monitor] Полное сканирование завершено: ${totalRisks} угроз`;

    let html = `
        <h2>Результаты полного сканирования CI/CD безопасности</h2>
        <p><strong>Общее количество проектов:</strong> ${projects.length}</p>
        <p><strong>Проектов с угрозами:</strong> ${projectsWithRisks.length}</p>
        <p><strong>Всего угроз:</strong> ${totalRisks}</p>
        <p><strong>Распределение угроз:</strong></p>
        <ul>
            <li><strong>critical:</strong> ${totalCritical}</li>
            <li><strong>high:</strong> ${totalHigh}</li>
            <li><strong>medium:</strong> ${totalMedium}</li>
            <li><strong>low:</strong> ${totalLow}</li>
        </ul>
    `;

    if (projectsWithRisks.length > 0) {
        html += `<h3>Проекты с угрозами:</h3><table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;"><tr><th>Проект</th><th>C</th><th>H</th><th>M</th><th>L</th><th>Всего</th></tr>`;
        
        projectsWithRisks.forEach(project => {
            html += `<tr><td><strong>${project.name}</strong></td><td>${project.critical}</td><td>${project.high}</td><td>${project.medium}</td><td>${project.low}</td><td><strong>${project.total}</strong></td></tr>`;
        });
        
        html += `</table>`;
    } else {
        html += `<p><strong>Угроз не обнаружено во всех проектах!</strong></p>`;
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
    console.log(project)
    const critical = scanResult.summary?.critical || 0;
    const high = scanResult.summary?.high || 0;
    const medium = scanResult.summary?.medium || 0;
    const low = scanResult.summary?.low || 0;
    const totalRisks = scanResult.summary?.totalRisks || 0;
    
    const projectName = project.dataValues.name || `Проект ${project?.dataValues?.gitlabProjectId}`;

    const subject = `[Security Monitor] Сканирование проекта "${projectName}": ${totalRisks} рисков`;

    let html = `
        <h2>Результаты сканирования проекта</h2>
        <p><strong>Проект:</strong> ${projectName}</p>
        <p><strong>GitLab ID:</strong> ${project.dataValues.gitlabProjectId}</p>
        <p><strong>Общее количество угроз:</strong> ${totalRisks}</p>
        <p><strong>Распределение угроз:</strong></p>
        <ul>
            <li><strong>critical:</strong> ${critical}</li>
            <li><strong>high:</strong> ${high}</li>
            <li><strong>medium:</strong> ${medium}</li>
            <li><strong>low:</strong> ${low}</li>
        </ul>
    `;

    if (totalRisks > 0) {
        html += `<h3>Обнаруженные проблемы:</h3>`;
        
        // Добавляем детали ВСЕХ проверок, не только критических
        const allChecks = scanResult.results || [];
        
        if (allChecks.length > 0) {
            html += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;"><tr><th>Проверка</th><th>Статус</th><th>Угрозы</th></tr>`;
            
            allChecks.forEach(check => {
                const criticalItems = check.results?.filter(r => r.severity?.toLowerCase() === 'critical') || [];
                const highItems = check.results?.filter(r => r.severity?.toLowerCase() === 'high') || [];
                const mediumItems = check.results?.filter(r => r.severity?.toLowerCase() === 'medium') || [];
                const lowItems = check.results?.filter(r => r.severity?.toLowerCase() === 'low') || [];
                
                const totalCheckRisks = criticalItems.length + highItems.length + mediumItems.length + lowItems.length;
                
                if (totalCheckRisks > 0) {
                    html += `<tr><td><strong>${check.name}</strong></td><td>${check.id}</td><td>${totalCheckRisks} (C:${criticalItems.length}, H:${highItems.length}, M:${mediumItems.length}, L:${lowItems.length})</td></tr>`;
                }
            });
            
            html += `</table>`;
        }
    } else {
        html += `<p><strong>Угроз не обнаружено!</strong></p>`;
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