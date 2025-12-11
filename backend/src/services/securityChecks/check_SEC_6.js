// // module.exports = async function checkSEC6(projectId, gitlab) {
// //   const variables = await gitlab.getProjectVariables(projectId);

// //   const results = [];

// //   // Секреты в коде и слабые пароли
// //   const insecureVars = variables.filter(v => /password|token|secret/i.test(v.key));

// //   results.push({
// //     item: "Проверка секретов",
// //     status: insecureVars.length ? "WARN" : "OK",
// //     details: insecureVars.length
// //       ? `Возможные небезопасные переменные: ${insecureVars.map(v => v.key).join(", ")}`
// //       : "Нет явных проблем с секретами"
// //   });

// //   return {
// //     id: "CICD-SEC-6",
// //     name: "Недостаточная гигиена секретов",
// //     results
// //   };
// // };

// module.exports = async function checkSEC6(projectId, project, gitlab) {
//   const results = [];
  
//   try {
//     // 1. Проверка переменных окружения проекта
//     const variables = await gitlab.getProjectVariables(projectId);
//     const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
    
//     // Категории секретов
//     const secretCategories = {
//       tokens: [],
//       passwords: [],
//       keys: [],
//       credentials: [],
//       other: []
//     };
    
//     // Анализ переменных на предмет секретов
//     variables.forEach(variable => {
//       const key = variable.key.toLowerCase();
//       const value = variable.value || '';
      
//       // Определяем категорию
//       if (key.includes('token') || key.includes('_token') || key.endsWith('_token')) {
//         secretCategories.tokens.push(variable);
//       } else if (key.includes('password') || key.includes('_password') || key.endsWith('_password')) {
//         secretCategories.passwords.push(variable);
//       } else if (key.includes('key') || key.includes('_key') || key.endsWith('_key') || key.includes('secret')) {
//         secretCategories.keys.push(variable);
//       } else if (key.includes('credential') || key.includes('auth') || key.includes('login')) {
//         secretCategories.credentials.push(variable);
//       } else if (value.length > 20 && /^[a-zA-Z0-9+/=]{20,}$/.test(value)) {
//         // Длинные base64 строки могут быть секретами
//         secretCategories.other.push(variable);
//       }
//     });
    
//     const totalSecrets = Object.values(secretCategories).reduce((sum, arr) => sum + arr.length, 0);
    
//     results.push({
//       item: "Обнаруженные секреты в переменных",
//       status: totalSecrets > 0 ? "INFO" : "OK",
//       details: totalSecrets > 0
//         ? `Обнаружено секретов: Токены (${secretCategories.tokens.length}), Пароли (${secretCategories.passwords.length}), Ключи (${secretCategories.keys.length}), Учётные данные (${secretCategories.credentials.length}), Другие (${secretCategories.other.length})`
//         : "Секреты в переменных не обнаружены.",
//       severity: "low"
//     });
    
//     // 2. Проверка защиты переменных
//     const unprotectedSecrets = [];
    
//     Object.values(secretCategories).forEach(category => {
//       category.forEach(secret => {
//         if (!secret.protected || secret.masked === false) {
//           unprotectedSecrets.push(secret);
//         }
//       });
//     });
    
//     if (unprotectedSecrets.length > 0) {
//       results.push({
//         item: "Незащищённые секретные переменные",
//         status: "FAIL",
//         details: `Обнаружено ${unprotectedSecrets.length} незащищённых секретных переменных: ${unprotectedSecrets.map(s => s.key).join(', ')}. Установите protected: true и masked: true.`,
//         severity: "critical"
//       });
//     }
    
//     // 3. Проверка файлов на наличие хардкодных секретов
//     const suspiciousFiles = [];
//     const secretPatterns = [
//       { pattern: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/gi, name: "Пароли" },
//       { pattern: /(token|access_token|api_key)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "Токены" },
//       { pattern: /(secret|secret_key)\s*[:=]\s*["'][^"']{8,}["']/gi, name: "Секретные ключи" },
//       { pattern: /BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY/gi, name: "Приватные ключи" },
//       { pattern: /(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "AWS ключи" },
//       { pattern: /(database_url|db_url)\s*[:=]\s*["'].*:.*@/gi, name: "Database URL с паролями" },
//       { pattern: /(Authorization|Bearer)\s*:\s*[A-Za-z0-9._-]{20,}/gi, name: "Authorization headers" }
//     ];
    
//     // Проверяем только определённые типы файлов
//     const fileTypesToCheck = [
//       '.env', '.env.example', '.env.local', '.env.production',
//       '.json', '.yaml', '.yml', '.toml',
//       '.js', '.ts', '.py', '.java', '.go', '.rb',
//       '.sh', '.bash', '.zsh'
//     ];
    
//     const filesToCheck = repoTree.filter(file => 
//       fileTypesToCheck.some(ext => file.name.endsWith(ext)) &&
//       file.type === 'blob'
//     ).slice(0, 20); // Ограничиваем количество проверяемых файлов
    
//     for (const file of filesToCheck) {
//       try {
//         const content = await gitlab.getRawFile(projectId, file.path);
        
//         secretPatterns.forEach(pattern => {
//           const matches = content.match(pattern.pattern);
//           if (matches && matches.length > 0) {
//             suspiciousFiles.push({
//               file: file.path,
//               pattern: pattern.name,
//               matches: matches.slice(0, 3) // Ограничиваем количество примеров
//             });
//           }
//         });
//       } catch (error) {
//         // Пропускаем файлы, которые не удалось прочитать
//         continue;
//       }
//     }
    
//     if (suspiciousFiles.length > 0) {
//       const fileDetails = suspiciousFiles.map(f => 
//         `${f.file}: ${f.pattern} (примеры: ${f.matches.map(m => m.substring(0, 30) + '...').join(', ')})`
//       ).join('\n');
      
//       results.push({
//         item: "Хардкод секретов в файлах",
//         status: "FAIL",
//         details: `Обнаружены потенциальные секреты в файлах:\n${fileDetails}`,
//         severity: "critical"
//       });
//     }
    
//     // 4. Проверка .gitignore на исключение файлов с секретами
//     const gitignoreFiles = repoTree.filter(file => file.name === '.gitignore');
//     let hasGitignoreForSecrets = false;
    
//     if (gitignoreFiles.length > 0) {
//       try {
//         const gitignoreContent = await gitlab.getRawFile(projectId, '.gitignore');
//         const secretFilePatterns = ['.env', '*.pem', '*.key', '*.crt', 'secrets/', 'credentials/'];
        
//         hasGitignoreForSecrets = secretFilePatterns.some(pattern => 
//           gitignoreContent.includes(pattern)
//         );
//       } catch (error) {
//         // Не удалось прочитать .gitignore
//       }
//     }
    
//     results.push({
//       item: "Защита файлов с секретами в .gitignore",
//       status: hasGitignoreForSecrets ? "OK" : "WARN",
//       details: hasGitignoreForSecrets
//         ? ".gitignore содержит паттерны для защиты файлов с секретами."
//         : ".gitignore не содержит паттернов для защиты файлов с секретами. Добавьте .env, *.key и т.д.",
//       severity: "medium"
//     });
    
//     // 5. Проверка ротации секретов (анализ по времени создания)
//     const now = new Date();
//     const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней
    
//     const oldSecrets = variables.filter(v => {
//       if (!v.created_at) return false;
//       const created = new Date(v.created_at);
//       return (now - created) > rotationThreshold;
//     });
    
//     if (oldSecrets.length > 0) {
//       results.push({
//         item: "Устаревшие секреты (более 90 дней)",
//         status: "WARN",
//         details: `Обнаружено ${oldSecrets.length} секретов, созданных более 90 дней назад: ${oldSecrets.map(s => s.key).join(', ')}. Рекомендуется ротация.`,
//         severity: "medium"
//       });
//     }
    
//     // 6. Проверка CI/CD конфигурации на безопасную работу с секретами
//     try {
//       const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
//       if (gitlabCI) {
//         const lines = gitlabCI.split('\n');
        
//         // Проверка на эхо секретов в логах
//         let hasSecretEcho = false;
//         lines.forEach((line, index) => {
//           if (line.includes('echo') && line.includes('$')) {
//             const varMatch = line.match(/\$([A-Z_][A-Z0-9_]+)/g);
//             if (varMatch) {
//               const suspiciousVars = varMatch.filter(v => 
//                 v.includes('TOKEN') || 
//                 v.includes('SECRET') || 
//                 v.includes('PASSWORD') ||
//                 v.includes('KEY')
//               );
//               if (suspiciousVars.length > 0) {
//                 hasSecretEcho = true;
//               }
//             }
//           }
//         });
        
//         if (hasSecretEcho) {
//           results.push({
//             item: "Эхо секретов в CI/CD логах",
//             status: "FAIL",
//             details: "Обнаружено echo переменных, которые могут содержать секреты. Это может привести к утечке секретов в логах.",
//             severity: "high"
//           });
//         }
        
//         // Проверка на передачу секретов через command line
//         const commandLineSecrets = lines.filter(line => 
//           line.includes('curl') && 
//           (line.includes('-H "Authorization:') || line.includes('--header "Authorization:'))
//         );
        
//         if (commandLineSecrets.length > 0) {
//           results.push({
//             item: "Передача секретов через command line",
//             status: "WARN",
//             details: "Обнаружена передача секретов через command line аргументы. Они могут быть видны в процессах системы.",
//             severity: "medium"
//           });
//         }
//       }
//     } catch (error) {
//       // Не удалось проанализировать конфигурацию
//     }
    
//     // 7. Проверка на использование HashiCorp Vault или других систем управления секретами
//     try {
//       const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
//       const hasSecretManager = gitlabCI && (
//         gitlabCI.includes('vault') ||
//         gitlabCI.includes('aws secretsmanager') ||
//         gitlabCI.includes('azure keyvault') ||
//         gitlabCI.includes('gcp secretmanager')
//       );
      
//       results.push({
//         item: "Использование систем управления секретами",
//         status: hasSecretManager ? "OK" : "INFO",
//         details: hasSecretManager
//           ? "Обнаружено использование системы управления секретами."
//           : "Не обнаружено использование систем управления секретами (Vault, AWS Secrets Manager и т.д.).",
//         severity: "low"
//       });
//     } catch (error) {
//       // Не удалось проанализировать конфигурацию
//     }
    
//     // 8. Проверка веток на наличие коммитов с секретами
//     const branches = await gitlab.getBranches(projectId);
//     const mainBranches = branches.filter(b => b.name === 'main' || b.name === 'master');
    
//     if (mainBranches.length > 0) {
//       // Здесь можно добавить проверку истории коммитов через GitLab API
//       // Но это требует дополнительных прав и может быть ресурсоёмко
//       results.push({
//         item: "Проверка истории коммитов на секреты",
//         status: "INFO",
//         details: "Для полной проверки истории коммитов на наличие секретов рекомендуется использовать инструменты типа git-secrets или gitleaks.",
//         severity: "low"
//       });
//     }
    
//   } catch (error) {
//     console.error(`Error in SEC-6 check for project ${projectId}:`, error);
//     results.push({
//       item: "Проверка гигиены секретов",
//       status: "FAIL",
//       details: `Ошибка при выполнении проверки: ${error.message}`,
//       severity: "info"
//     });
//   }
  
//   return {
//     id: "CICD-SEC-6",
//     name: "Недостаточная гигиена секретов",
//     results
//   };
// };

module.exports = async function checkSEC6(projectId, projectData, gitlab) {
  const {
    projectVariables = [],
    repoTree = [],
    gitlabCIRaw = null,
    branches = []
  } = projectData;

  const results = [];

  try {
    // ============ ПРОВЕРКИ ГИГИЕНЫ СЕКРЕТОВ ============
    
    // 1. Анализ переменных окружения на наличие секретов
    checkSecretVariables(results, projectVariables);
    
    // 2. Проверка защиты переменных (masked, protected)
    checkVariableProtection(results, projectVariables);
    
    // 3. Проверка ротации секретов
    checkSecretRotation(results, projectVariables);
    
    // 4. Проверка файлов на наличие хардкодных секретов
    await checkHardcodedSecrets(results, repoTree, projectId, gitlab);
    
    // 5. Проверка .gitignore на исключение файлов с секретами
    checkGitignoreForSecrets(results, repoTree, projectId, gitlab);
    
    // 6. Проверка CI/CD конфигурации на безопасную работу с секретами
    checkCICDSecretSafety(results, gitlabCIRaw);
    
    // 7. Проверка на использование систем управления секретами
    checkSecretManagementSystems(results, gitlabCIRaw);
    
  } catch (error) {
    console.error(`Error in SEC-6 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка гигиены секретов",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }

  return {
    id: "CICD-SEC-6",
    name: "Недостаточная гигиена секретов",
    results
  };
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

/**
 * 1. Анализ переменных окружения на наличие секретов
 */
function checkSecretVariables(results, projectVariables) {
  // Категории секретов
  const secretCategories = {
    tokens: [],
    passwords: [],
    keys: [],
    credentials: [],
    other: []
  };

  // Анализ переменных на предмет секретов
  projectVariables.forEach(variable => {
    const key = variable.key ? variable.key.toLowerCase() : '';
    const value = variable.value || "";
    
    // Определяем категорию
    if (key.includes('token') || key.includes('.token') || key.endsWith('_token')) {
      secretCategories.tokens.push(variable);
    } else if (key.includes('password') || key.includes('.password') || key.endsWith('_password')) {
      secretCategories.passwords.push(variable);
    } else if (key.includes('key') || key.includes('.key') || key.endsWith('_key') || key.includes('secret')) {
      secretCategories.keys.push(variable);
    } else if (key.includes('credential') || key.includes('auth') || key.includes('login')) {
      secretCategories.credentials.push(variable);
    } else if (value.length > 20 && /^[a-zA-Z0-9+/=]{20,}$/.test(value)) {
      // Длинные base64 строки могут быть секретами
      secretCategories.other.push(variable);
    }
  });

  const totalSecrets = Object.values(secretCategories).reduce((sum, arr) => sum + arr.length, 0);

  results.push({
    item: "Обнаруженные секреты в переменных",
    status: totalSecrets > 0 ? "INFO" : "OK",
    details: totalSecrets > 0
      ? `Обнаружено секретов: Токены (${secretCategories.tokens.length}), Пароли (${secretCategories.passwords.length}), Ключи (${secretCategories.keys.length}), Учётные данные (${secretCategories.credentials.length}), Другие (${secretCategories.other.length})`
      : "Секреты в переменных не обнаружены.",
    severity: "low"
  });
}

/**
 * 2. Проверка защиты переменных (masked, protected)
 */
function checkVariableProtection(results, projectVariables) {
  const secretVariables = projectVariables.filter(v => 
    v.key && (
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key') ||
      v.key.toLowerCase().includes('credential')
    )
  );

  // Проверка незащищённых секретов
  const unprotectedSecrets = secretVariables.filter(secret => 
    !secret.protected || secret.masked === false
  );

  if (unprotectedSecrets.length > 0) {
    results.push({
      item: "Незащищённые секретные переменные",
      status: "FAIL",
      details: `Обнаружено ${unprotectedSecrets.length} незащищённых секретных переменных: ${unprotectedSecrets.map(s => s.key).slice(0, 5).join(', ')}${unprotectedSecrets.length > 5 ? '...' : ''}. Установите protected: true и masked: true.`,
      severity: "critical"
    });
  }

  // Проверка переменных с типом "file"
  const fileVariables = projectVariables.filter(v => v.variable_type === 'file');
  
  if (fileVariables.length > 0) {
    results.push({
      item: "Файловые переменные окружения",
      status: "INFO",
      details: `Обнаружено ${fileVariables.length} файловых переменных. Убедитесь, что они защищены.`,
      severity: "low"
    });
  }
}

/**
 * 3. Проверка ротации секретов
 */
function checkSecretRotation(results, projectVariables) {
  const now = new Date();
  const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней

  const secretVariables = projectVariables.filter(v => 
    v.key && (
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key')
    )
  );

  const oldSecrets = secretVariables.filter(v => {
    if (!v.created_at) return false;
    const created = new Date(v.created_at);
    return (now - created) > rotationThreshold;
  });

  if (oldSecrets.length > 0) {
    results.push({
      item: "Устаревшие секреты (более 90 дней)",
      status: "WARN",
      details: `Обнаружено ${oldSecrets.length} секретов, созданных более 90 дней назад. Рекомендуется регулярная ротация.`,
      severity: "medium"
    });
  }
}

/**
 * 4. Проверка файлов на наличие хардкодных секретов
 * Требует дополнительных запросов GitLab API
 */
async function checkHardcodedSecrets(results, repoTree, projectId, gitlab) {
  if (!repoTree || repoTree.length === 0) return;

  const suspiciousFiles = [];
  const secretPatterns = [
    { pattern: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/gi, name: "Пароли" },
    { pattern: /(token|access_token|api_key)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "Токены" },
    { pattern: /(secret|secret_key)\s*[:=]\s*["'][^"']{8,}["']/gi, name: "Секретные ключи" },
    { pattern: /BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY/gi, name: "Приватные ключи" },
    { pattern: /(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "AWS ключи" }
  ];

  // Проверяем только определённые типы файлов
  const fileTypesToCheck = [
    '.env', '.env.example', '.env.local', '.env.production',
    '.json', '.yaml', '.yml', '.toml',
    '.js', '.ts', '.py', '.java', '.go', '.rb',
    '.sh', '.bash', '.zsh'
  ];

  const filesToCheck = repoTree.filter(file =>
    fileTypesToCheck.some(ext => file.name.endsWith(ext)) &&
    file.type === 'blob'
  ).slice(0, 10); // Ограничиваем количество проверяемых файлов

  for (const file of filesToCheck) {
    try {
      const content = await gitlab.getRawFile(projectId, file.path);

      secretPatterns.forEach(pattern => {
        const matches = content.match(pattern.pattern);
        if (matches && matches.length > 0) {
          suspiciousFiles.push({
            file: file.path,
            pattern: pattern.name,
            matches: matches.slice(0, 3) // Ограничиваем количество примеров
          });
        }
      });
    } catch (error) {
      // Пропускаем файлы, которые не удалось прочитать
      continue;
    }
  }

  if (suspiciousFiles.length > 0) {
    const fileDetails = suspiciousFiles.map(f =>
      `${f.file}: ${f.pattern}`
    ).slice(0, 3).join('\n');

    results.push({
      item: "Хардкод секретов в файлах",
      status: "FAIL",
      details: `Обнаружены потенциальные секреты в файлах:\n${fileDetails}${suspiciousFiles.length > 3 ? '\n...' : ''}`,
      severity: "critical"
    });
  }
}

/**
 * 5. Проверка .gitignore на исключение файлов с секретами
 */
async function checkGitignoreForSecrets(results, repoTree, projectId, gitlab) {
  const gitignoreFiles = repoTree.filter(file => file.name === '.gitignore');
  let hasGitignoreForSecrets = false;

  if (gitignoreFiles.length > 0) {
    try {
      const gitignoreContent = await gitlab.getRawFile(projectId, '.gitignore');
      const secretFilePatterns = ['.env', '*.pem', '*.key', '*.crt', 'secrets/', 'credentials/'];

      hasGitignoreForSecrets = secretFilePatterns.some(pattern =>
        gitignoreContent.includes(pattern)
      );
    } catch (error) {
      // Не удалось прочитать .gitignore
    }
  }

  results.push({
    item: "Защита файлов с секретами в .gitignore",
    status: hasGitignoreForSecrets ? "OK" : "WARN",
    details: hasGitignoreForSecrets
      ? ".gitignore содержит паттерны для защиты файлов с секретами."
      : ".gitignore не содержит паттернов для защиты файлов с секретами. Добавьте .env, *.key и т.д.",
    severity: "medium"
  });
}

/**
 * 6. Проверка CI/CD конфигурации на безопасную работу с секретами
 */
function checkCICDSecretSafety(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;

  const lines = gitlabCIRaw.split('\n');

  // Проверка на эхо секретов в логах
  let hasSecretEcho = false;
  lines.forEach((line, index) => {
    if (line.includes('echo') && line.includes('$')) {
      const varMatch = line.match(/\${[A-Z_][A-Z0-9_]+}/g);
      if (varMatch) {
        const suspiciousVars = varMatch.filter(v =>
          v.includes('TOKEN') ||
          v.includes('SECRET') ||
          v.includes('PASSWORD') ||
          v.includes('KEY')
        );
        if (suspiciousVars.length > 0) {
          hasSecretEcho = true;
        }
      }
    }
  });

  if (hasSecretEcho) {
    results.push({
      item: "Эхо секретов в CI/CD логах",
      status: "FAIL",
      details: "Обнаружено echo переменных, которые могут содержать секреты. Это может привести к утечке секретов в логах.",
      severity: "high"
    });
  }

  // Проверка на передачу секретов через command line
  const commandLineSecrets = lines.filter(line =>
    line.includes('curl') &&
    (line.includes('-H "Authorization:') || line.includes('--header "Authorization:'))
  );

  if (commandLineSecrets.length > 0) {
    results.push({
      item: "Передача секретов через command line",
      status: "WARN",
      details: "Обнаружена передача секретов через command line аргументы. Они могут быть видны в процессах системы.",
      severity: "medium"
    });
  }
}

/**
 * 7. Проверка на использование систем управления секретами
 */
function checkSecretManagementSystems(results, gitlabCIRaw) {
  if (!gitlabCIRaw) {
    results.push({
      item: "Использование систем управления секретами",
      status: "INFO",
      details: "CI/CD конфигурация не найдена.",
      severity: "low"
    });
    return;
  }

  const hasSecretManager = gitlabCIRaw.includes('vault') ||
    gitlabCIRaw.includes('aws secretsmanager') ||
    gitlabCIRaw.includes('azure keyvault') ||
    gitlabCIRaw.includes('gcp secretmanager');

  results.push({
    item: "Использование систем управления секретами",
    status: hasSecretManager ? "OK" : "INFO",
    details: hasSecretManager
      ? "Обнаружено использование системы управления секретами."
      : "Не обнаружено использование систем управления секретами (Vault, AWS Secrets Manager и т.д.).",
    severity: "low"
  });
}