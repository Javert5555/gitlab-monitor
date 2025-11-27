<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-brand">
        🔒 Security Monitor CI/CD
      </div>
      <div class="nav-links">
        <router-link to="/">Дашборд</router-link>
        <router-link to="/projects">Проекты</router-link>
        <router-link to="/scans">Сканирования</router-link>
      </div>
    </nav>
    
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
// Основной компонент приложения
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

.navbar {
  background: #2c3e50;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nav-brand {
  font-size: 1.5rem;
  font-weight: bold;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-links a:hover, .nav-links a.router-link-active {
  background-color: #34495e;
}

.main-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
</style>