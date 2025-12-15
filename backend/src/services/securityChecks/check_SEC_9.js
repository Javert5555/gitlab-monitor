// module.exports = async function checkSEC9(projectId, gitlab) {
//   const pipelines = await gitlab.getProjectPipelines(projectId);

//   const results = [];

//   results.push({
//     item: "Проверка целостности артефактов",
//     status: pipelines.length ? "WARN" : "OK",
//     details: "Для проверки целостности артефактов требуется SCA/CI scan, выставляем WARN"
//   });

//   return {
//     id: "SEC-CICD-9",
//     name: "Некорректная валидация артефактов",
//     results
//   };
// };

// module.exports = async function checkSEC9(projectId, project, gitlab) {
//   const results = [];
  
//   try {
//     // 1. Проверка наличия CI/CD конфигурации
//     let gitlabCI = null;
//     try {
//       gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
//     } catch (error) {
//       results.push({
//         item: "CI/CD конфигурация",
//         status: "INFO",
//         details: "CI/CD конфигурация не найдена. Проверка валидации артефактов невозможна.",
//         severity: "low"
//       });
//       return {
//         id: "SEC-CICD-9",
//         name: "Ненадлежащая проверка целостности артефактов",
//         results
//       };
//     }
    
//     // 2. Анализ CI/CD конфигурации на предмет валидации артефактов
//     const lines = gitlabCI.split('\n');
    
//     // Проверка: Наличие этапов проверки целостности
//     const hasIntegrityChecks = lines.some(line => 
//       line.includes('checksum') ||
//       line.includes('sha256') ||
//       line.includes('sha1') ||
//       line.includes('md5') ||
//       line.includes('verify') ||
//       line.includes('validate') ||
//       line.includes('integrity')
//     );
    
//     results.push({
//       item: "Проверка целостности артефактов в CI/CD",
//       status: hasIntegrityChecks ? "OK" : "WARN",
//       details: hasIntegrityChecks
//         ? "Обнаружены проверки целостности артефактов в конфигурации."
//         : "Не обнаружены проверки целостности артефактов. Рекомендуется добавить проверку контрольных сумм.",
//       severity: "medium"
//     });
    
//     // 3. Проверка на использование подписанных артефактов
//     const hasSignatureChecks = lines.some(line => 
//       line.includes('gpg') ||
//       line.includes('pgp') ||
//       line.includes('signature') ||
//       line.includes('cosign') ||
//       line.includes('notary')
//     );
    
//     results.push({
//       item: "Проверка подписей артефактов",
//       status: hasSignatureChecks ? "OK" : "INFO",
//       details: hasSignatureChecks
//         ? "Обнаружены проверки цифровых подписей артефактов."
//         : "Не обнаружены проверки цифровых подписей. Рекомендуется использовать подписанные артефакты.",
//       severity: "low"
//     });
    
//     // 4. Проверка на загрузку артефактов из внешних источников
//     const externalDownloads = [];
//     const downloadPatterns = [
//       { pattern: /curl.*-o.*(http|https):\/\//i, description: "Загрузка через curl" },
//       { pattern: /wget.*(http|https):\/\//i, description: "Загрузка через wget" },
//       { pattern: /docker pull.*(http|https):\/\//i, description: "Загрузка Docker образа" },
//       { pattern: /npm install.*--registry.*(http|https):\/\//i, description: "Загрузка npm пакетов" },
//       { pattern: /pip install.*--index-url.*(http|https):\/\//i, description: "Загрузка Python пакетов" }
//     ];
    
//     lines.forEach((line, index) => {
//       downloadPatterns.forEach(pattern => {
//         if (pattern.pattern.test(line)) {
//           externalDownloads.push({
//             line: index + 1,
//             description: pattern.description,
//             content: line.trim()
//           });
//         }
//       });
//     });
    
//     if (externalDownloads.length > 0) {
//       // Проверяем, есть ли валидация для этих загрузок
//       const downloadsWithoutValidation = [];
//       externalDownloads.forEach(download => {
//         // Ищем проверки целостности вблизи загрузки
//         const start = Math.max(0, download.line - 10);
//         const end = Math.min(lines.length, download.line + 10);
//         const context = lines.slice(start - 1, end);
        
//         const hasValidationNearby = context.some(contextLine => 
//           contextLine.includes('checksum') ||
//           contextLine.includes('sha256') ||
//           contextLine.includes('verify')
//         );
        
//         if (!hasValidationNearby) {
//           downloadsWithoutValidation.push(download);
//         }
//       });
      
//       if (downloadsWithoutValidation.length > 0) {
//         results.push({
//           item: "Загрузка артефактов без проверки целостности",
//           status: "DANGER",
//           details: `Обнаружены загрузки артефактов без проверки целостности:\n${downloadsWithoutValidation.map(d => `Строка ${d.line}: ${d.description} - "${d.content}"`).join('\n')}`,
//           severity: "high"
//         });
//       }
//     }
    
//     // 5. Проверка на использование артефактов между stages
//     const artifactTransfers = [];
//     const artifactPatterns = [
//       /artifacts:\s*$/i,
//       /paths:\s*$/i,
//       /dependencies:\s*$/i
//     ];
    
//     let inArtifactsSection = false;
//     let currentJob = '';
    
//     lines.forEach((line, index) => {
//       // Определяем начало job
//       if (line.includes(':') && !line.startsWith(' ') && !line.startsWith('\t') && 
//           !line.includes('#') && line.trim() !== '') {
//         currentJob = line.split(':')[0].trim();
//       }
      
//       // Определяем секцию artifacts
//       if (artifactPatterns.some(pattern => pattern.test(line))) {
//         inArtifactsSection = true;
//         artifactTransfers.push({
//           job: currentJob,
//           line: index + 1,
//           type: 'artifacts'
//         });
//       }
      
//       // Выход из секции artifacts
//       if (inArtifactsSection && 
//           line.trim() !== '' && 
//           !line.startsWith(' ') && 
//           !line.startsWith('\t') && 
//           !line.includes('  ') && 
//           !artifactPatterns.some(pattern => pattern.test(line))) {
//         inArtifactsSection = false;
//       }
//     });
    
//     if (artifactTransfers.length > 0) {
//       results.push({
//         item: "Передача артефактов между stages",
//         status: "INFO",
//         details: `Обнаружена передача артефактов в ${artifactTransfers.length} job(s). Убедитесь в их целостности.`,
//         severity: "low"
//       });
//     }
    
//     // 6. Проверка на использование кеширования артефактов
//     const hasCaching = lines.some(line => line.includes('cache:') && line.trim() !== 'cache:');
    
//     if (hasCaching) {
//       results.push({
//         item: "Кеширование артефактов",
//         status: "INFO",
//         details: "Обнаружено кеширование артефактов. Убедитесь, что кешированные артефакты валидируются при использовании.",
//         severity: "low"
//       });
//     }
    
//     // 7. Проверка на использование Docker образов
//     const dockerImages = [];
//     const imagePattern = /image:\s*["']?([^"'\s]+)["']?/gi;
//     let match;
    
//     while ((match = imagePattern.exec(gitlabCI)) !== null) {
//       const image = match[1];
//       if (!image.includes('$') && !image.startsWith('.')) { // Исключаем переменные и локальные пути
//         dockerImages.push(image);
//       }
//     }
    
//     if (dockerImages.length > 0) {
//       // Проверяем, используются ли теги вместо digest
//       const imagesWithTags = dockerImages.filter(image => 
//         image.includes(':') && !image.includes('@sha256:')
//       );
      
//       if (imagesWithTags.length > 0) {
//         results.push({
//           item: "Docker образы с тегами вместо digest",
//           status: "DANGER",
//           details: `Обнаружены Docker образы с тегами: ${imagesWithTags.join(', ')}. Используйте digest (@sha256:...) для гарантии целостности.`,
//           severity: "high"
//         });
//       }
//     }
    
//     // 8. Проверка на использование внешних зависимостей
//     const externalDependencies = [];
//     const dependencyPatterns = [
//       /npm install/i,
//       /pip install/i,
//       /go get/i,
//       /bundle install/i,
//       /composer install/i,
//       /yarn add/i
//     ];
    
//     lines.forEach((line, index) => {
//       dependencyPatterns.forEach(pattern => {
//         if (pattern.test(line)) {
//           externalDependencies.push({
//             line: index + 1,
//             command: line.trim().substring(0, 50) + (line.length > 50 ? '...' : '')
//           });
//         }
//       });
//     });
    
//     if (externalDependencies.length > 0) {
//       results.push({
//         item: "Установка внешних зависимостей",
//         status: "INFO",
//         details: `Обнаружена установка внешних зависимостей в ${externalDependencies.length} месте(ах). Убедитесь в использовании lock-файлов.`,
//         severity: "low"
//       });
//     }
    
//     // 9. Проверка на наличие проверок скачиваемых скриптов
//     const scriptDownloads = [];
//     const scriptPattern = /(curl|wget).*\.(sh|py|js)$/i;
    
//     lines.forEach((line, index) => {
//       if (scriptPattern.test(line)) {
//         // Проверяем, есть ли проверка скачанного скрипта
//         const start = Math.max(0, index - 5);
//         const end = Math.min(lines.length, index + 5);
//         const context = lines.slice(start, end);
        
//         const hasValidation = context.some(contextLine => 
//           contextLine.includes('sha256sum') ||
//           contextLine.includes('md5sum') ||
//           contextLine.includes('verify') ||
//           contextLine.includes('check')
//         );
        
//         scriptDownloads.push({
//           line: index + 1,
//           content: line.trim(),
//           hasValidation: hasValidation
//         });
//       }
//     });
    
//     if (scriptDownloads.length > 0) {
//       const unvalidatedScripts = scriptDownloads.filter(s => !s.hasValidation);
      
//       if (unvalidatedScripts.length > 0) {
//         results.push({
//           item: "Скачивание скриптов без проверки целостности",
//           status: "DANGER",
//           details: `Обнаружено скачивание скриптов без проверки целостности:\n${unvalidatedScripts.map(s => `Строка ${s.line}: "${s.content}"`).join('\n')}`,
//           severity: "critical"
//         });
//       }
//     }
    
//     // 10. Проверка на использование безопасных протоколов загрузки
//     const insecureDownloads = lines.filter((line, index) => 
//       (line.includes('curl http://') || line.includes('wget http://')) &&
//       !line.includes('localhost') &&
//       !line.includes('127.0.0.1')
//     );
    
//     if (insecureDownloads.length > 0) {
//       results.push({
//         item: "Загрузка по HTTP без шифрования",
//         status: "DANGER",
//         details: `Обнаружена загрузка по HTTP:\n${insecureDownloads.map((line, idx) => `Строка ${lines.indexOf(line) + 1}: "${line.trim()}"`).join('\n')}`,
//         severity: "high"
//       });
//     }
    
//     // 11. Проверка репозитория на наличие файлов проверки целостности
//     try {
//       const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
//       const integrityFiles = repoTree.filter(file => 
//         file.name.includes('checksum') ||
//         file.name.includes('sha256') ||
//         file.name.includes('.sig') ||
//         file.name.includes('.asc') ||
//         file.name === 'SHASUMS.txt' ||
//         file.name === 'checksums.txt'
//       );
      
//       if (integrityFiles.length > 0) {
//         results.push({
//           item: "Файлы проверки целостности в репозитории",
//           status: "OK",
//           details: `Обнаружены файлы проверки целостности: ${integrityFiles.map(f => f.name).join(', ')}`,
//           severity: "low"
//         });
//       }
//     } catch (error) {
//       // Не удалось получить список файлов
//     }
    
//     // 12. Проверка на использование package signing
//     try {
//       const repoTree = await gitlab.getRepositoryTree(projectId);
//       const hasNpmRc = repoTree.some(file => file.name === '.npmrc');
//       const hasPipConf = repoTree.some(file => file.name === 'pip.conf' || file.name === '.pypirc');
      
//       if (hasNpmRc) {
//         try {
//           const npmrcContent = await gitlab.getRawFile(projectId, '.npmrc');
//           if (npmrcContent.includes('sign-git-tag') || npmrcContent.includes('signature')) {
//             results.push({
//               item: "Подпись npm пакетов",
//               status: "OK",
//               details: "Обнаружена настройка подписи npm пакетов.",
//               severity: "low"
//             });
//           }
//         } catch (error) {
//           // Не удалось прочитать .npmrc
//         }
//       }
//     } catch (error) {
//       // Не удалось проверить конфигурации пакетных менеджеров
//     }
    
//   } catch (error) {
//     console.error(`Error in SEC-9 check for project ${projectId}:`, error);
//     results.push({
//       item: "Проверка валидации целостности артефактов",
//       status: "FAIL",
//       details: `Ошибка при выполнении проверки: ${error.message}`,
//       severity: "info"
//     });
//   }
  
//   return {
//     id: "SEC-CICD-9",
//     name: "Ненадлежащая проверка целостности артефактов",
//     results
//   };
// };

module.exports = async function checkSEC9(projectId, projectData, gitlab) {
  const results = [];
  
  try {
    // 1. Проверка наличия CI/CD конфигурации
    const gitlabCIRaw = projectData.gitlabCIRaw;
    
    if (!gitlabCIRaw) {
      results.push({
        item: "CI/CD конфигурация",
        status: "INFO",
        details: "CI/CD конфигурация не найдена. Проверка валидации артефактов невозможна.",
        severity: "low"
      });
      return {
        id: "SEC-CICD-9",
        name: "Ненадлежащая проверка целостности артефактов",
        results
      };
    }
    
    // 2. Анализ CI/CD конфигурации на предмет валидации артефактов
    const lines = gitlabCIRaw.split('\n');
    
    // Проверка: Наличие этапов проверки целостности
    const hasIntegrityChecks = lines.some(line => 
      line.includes('checksum') ||
      line.includes('sha256') ||
      line.includes('sha1') ||
      line.includes('md5') ||
      line.includes('verify') ||
      line.includes('validate') ||
      line.includes('integrity')
    );
    
    results.push({
      item: "Проверка целостности артефактов в CI/CD",
      status: hasIntegrityChecks ? "OK" : "WARN",
      details: hasIntegrityChecks
        ? "Обнаружены проверки целостности артефактов в конфигурации."
        : "Не обнаружены проверки целостности артефактов. Рекомендуется добавить проверку контрольных сумм.",
      severity: "medium"
    });
    
    // 3. Проверка на использование подписанных артефактов
    const hasSignatureChecks = lines.some(line => 
      line.includes('gpg') ||
      line.includes('pgp') ||
      line.includes('signature') ||
      line.includes('cosign') ||
      line.includes('notary')
    );
    
    results.push({
      item: "Проверка подписей артефактов",
      status: hasSignatureChecks ? "OK" : "INFO",
      details: hasSignatureChecks
        ? "Обнаружены проверки цифровых подписей артефактов."
        : "Не обнаружены проверки цифровых подписей. Рекомендуется использовать подписанные артефакты.",
      severity: "low"
    });
    
    // 4. Проверка на загрузку артефактов из внешних источников
    const externalDownloads = [];
    const downloadPatterns = [
      { pattern: /curl.*-o.*(http|https):\/\//i, description: "Загрузка через curl" },
      { pattern: /wget.*(http|https):\/\//i, description: "Загрузка через wget" },
      { pattern: /docker pull.*(http|https):\/\//i, description: "Загрузка Docker образа" },
      { pattern: /npm install.*--registry.*(http|https):\/\//i, description: "Загрузка npm пакетов" },
      { pattern: /pip install.*--index-url.*(http|https):\/\//i, description: "Загрузка Python пакетов" }
    ];
    
    lines.forEach((line, index) => {
      downloadPatterns.forEach(pattern => {
        if (pattern.pattern.test(line)) {
          externalDownloads.push({
            line: index + 1,
            description: pattern.description,
            content: line.trim()
          });
        }
      });
    });
    
    if (externalDownloads.length > 0) {
      // Проверяем, есть ли валидация для этих загрузок
      const downloadsWithoutValidation = [];
      externalDownloads.forEach(download => {
        // Ищем проверки целостности вблизи загрузки
        const start = Math.max(0, download.line - 10);
        const end = Math.min(lines.length, download.line + 10);
        const context = lines.slice(start - 1, end);
        
        const hasValidationNearby = context.some(contextLine => 
          contextLine.includes('checksum') ||
          contextLine.includes('sha256') ||
          contextLine.includes('verify')
        );
        
        if (!hasValidationNearby) {
          downloadsWithoutValidation.push(download);
        }
      });
      
      if (downloadsWithoutValidation.length > 0) {
        results.push({
          item: "Загрузка артефактов без проверки целостности",
          status: "DANGER",
          details: `Обнаружены загрузки артефактов без проверки целостности:\n${downloadsWithoutValidation.map(d => `Строка ${d.line}: ${d.description} - "${d.content}"`).join('\n')}`,
          severity: "high"
        });
      }
    }
    
    // 5. Проверка на использование артефактов между stages
    const artifactTransfers = [];
    const artifactPatterns = [
      /artifacts:\s*$/i,
      /paths:\s*$/i,
      /dependencies:\s*$/i
    ];
    
    let inArtifactsSection = false;
    let currentJob = '';
    
    lines.forEach((line, index) => {
      // Определяем начало job
      if (line.includes(':') && !line.startsWith(' ') && !line.startsWith('\t') && 
          !line.includes('#') && line.trim() !== '') {
        currentJob = line.split(':')[0].trim();
      }
      
      // Определяем секцию artifacts
      if (artifactPatterns.some(pattern => pattern.test(line))) {
        inArtifactsSection = true;
        artifactTransfers.push({
          job: currentJob,
          line: index + 1,
          type: 'artifacts'
        });
      }
      
      // Выход из секции artifacts
      if (inArtifactsSection && 
          line.trim() !== '' && 
          !line.startsWith(' ') && 
          !line.startsWith('\t') && 
          !line.includes('  ') && 
          !artifactPatterns.some(pattern => pattern.test(line))) {
        inArtifactsSection = false;
      }
    });
    
    if (artifactTransfers.length > 0) {
      results.push({
        item: "Передача артефактов между stages",
        status: "INFO",
        details: `Обнаружена передача артефактов в ${artifactTransfers.length} job(s). Убедитесь в их целостности.`,
        severity: "low"
      });
    }
    
    // 6. Проверка на использование кеширования артефактов
    const hasCaching = lines.some(line => line.includes('cache:') && line.trim() !== 'cache:');
    
    if (hasCaching) {
      results.push({
        item: "Кеширование артефактов",
        status: "INFO",
        details: "Обнаружено кеширование артефактов. Убедитесь, что кешированные артефакты валидируются при использовании.",
        severity: "low"
      });
    }
    
    // 7. Проверка на использование Docker образов
    const dockerImages = [];
    const imagePattern = /image:\s*["']?([^"'\s]+)["']?/gi;
    let match;
    
    while ((match = imagePattern.exec(gitlabCIRaw)) !== null) {
      const image = match[1];
      if (!image.includes('$') && !image.startsWith('.')) { // Исключаем переменные и локальные пути
        dockerImages.push(image);
      }
    }
    
    if (dockerImages.length > 0) {
      // Проверяем, используются ли теги вместо digest
      const imagesWithTags = dockerImages.filter(image => 
        image.includes(':') && !image.includes('@sha256:')
      );
      
      if (imagesWithTags.length > 0) {
        results.push({
          item: "Docker образы с тегами вместо digest",
          status: "DANGER",
          details: `Обнаружены Docker образы с тегами: ${imagesWithTags.join(', ')}. Используйте digest (@sha256:...) для гарантии целостности.`,
          severity: "high"
        });
      }
    }
    
    // 8. Проверка на использование внешних зависимостей
    const externalDependencies = [];
    const dependencyPatterns = [
      /npm install/i,
      /pip install/i,
      /go get/i,
      /bundle install/i,
      /composer install/i,
      /yarn add/i
    ];
    
    lines.forEach((line, index) => {
      dependencyPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          externalDependencies.push({
            line: index + 1,
            command: line.trim().substring(0, 50) + (line.length > 50 ? '...' : '')
          });
        }
      });
    });
    
    if (externalDependencies.length > 0) {
      results.push({
        item: "Установка внешних зависимостей",
        status: "INFO",
        details: `Обнаружена установка внешних зависимостей в ${externalDependencies.length} месте(ах). Убедитесь в использовании lock-файлов.`,
        severity: "low"
      });
    }
    
    // 9. Проверка на наличие проверок скачиваемых скриптов
    const scriptDownloads = [];
    const scriptPattern = /(curl|wget).*\.(sh|py|js)$/i;
    
    lines.forEach((line, index) => {
      if (scriptPattern.test(line)) {
        // Проверяем, есть ли проверка скачанного скрипта
        const start = Math.max(0, index - 5);
        const end = Math.min(lines.length, index + 5);
        const context = lines.slice(start, end);
        
        const hasValidation = context.some(contextLine => 
          contextLine.includes('sha256sum') ||
          contextLine.includes('md5sum') ||
          contextLine.includes('verify') ||
          contextLine.includes('check')
        );
        
        scriptDownloads.push({
          line: index + 1,
          content: line.trim(),
          hasValidation: hasValidation
        });
      }
    });
    
    if (scriptDownloads.length > 0) {
      const unvalidatedScripts = scriptDownloads.filter(s => !s.hasValidation);
      
      if (unvalidatedScripts.length > 0) {
        results.push({
          item: "Скачивание скриптов без проверки целостности",
          status: "DANGER",
          details: `Обнаружено скачивание скриптов без проверки целостности:\n${unvalidatedScripts.map(s => `Строка ${s.line}: "${s.content}"`).join('\n')}`,
          severity: "critical"
        });
      }
    }
    
    // 10. Проверка на использование безопасных протоколов загрузки
    const insecureDownloads = lines.filter((line, index) => 
      (line.includes('curl http://') || line.includes('wget http://')) &&
      !line.includes('localhost') &&
      !line.includes('127.0.0.1')
    );
    
    if (insecureDownloads.length > 0) {
      results.push({
        item: "Загрузка по HTTP без шифрования",
        status: "DANGER",
        details: `Обнаружена загрузка по HTTP:\n${insecureDownloads.map((line, idx) => `Строка ${lines.indexOf(line) + 1}: "${line.trim()}"`).join('\n')}`,
        severity: "high"
      });
    }
    
    // 11. Проверка репозитория на наличие файлов проверки целостности
    const repoTree = projectData.repoTree || [];
    const integrityFiles = repoTree.filter(file => 
      file.name && (
        file.name.includes('checksum') ||
        file.name.includes('sha256') ||
        file.name.includes('.sig') ||
        file.name.includes('.asc') ||
        file.name === 'SHASUMS.txt' ||
        file.name === 'checksums.txt'
      )
    );
    
    if (integrityFiles.length > 0) {
      results.push({
        item: "Файлы проверки целостности в репозитории",
        status: "OK",
        details: `Обнаружены файлы проверки целостности: ${integrityFiles.map(f => f.name).join(', ')}`,
        severity: "low"
      });
    }
    
    // 12. Проверка на наличие .npmrc и других конфигурационных файлов
    const npmrcFile = repoTree.find(file => file.name === '.npmrc');
    const pipConfFile = repoTree.find(file => file.name === 'pip.conf' || file.name === '.pypirc');
    
    if (npmrcFile) {
      results.push({
        item: "Конфигурация npm",
        status: "INFO",
        details: "Обнаружен файл .npmrc. Возможна настройка подписи пакетов.",
        severity: "low"
      });
    }
    
    if (pipConfFile) {
      results.push({
        item: "Конфигурация pip",
        status: "INFO",
        details: "Обнаружен файл конфигурации pip. Возможна настройка подписи пакетов.",
        severity: "low"
      });
    }
    
  } catch (error) {
    console.error(`Error in SEC-9 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка валидации целостности артефактов",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "SEC-CICD-9",
    name: "Ненадлежащая проверка целостности артефактов",
    results
  };
};