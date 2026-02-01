<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-container">
        <h1 class="nav-title">Security Monitor CI/CD</h1>
        <div class="nav-links">
          <router-link to="/" class="nav-link">Главная</router-link>
          <router-link to="/projects" class="nav-link">Проекты</router-link>
        </div>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #121212;
  color: #e0e0e0;
  min-height: 100vh;
}

.navbar {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #ffffff;
  padding: 1rem 0;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #2a2a3e;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
}

.nav-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #64b5f6;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: #bbbbbb;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  background-color: rgba(100, 181, 246, 0.15);
  color: #64b5f6;
}

.nav-link.router-link-active {
  background-color: rgba(100, 181, 246, 0.25);
  color: #64b5f6;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: calc(100vh - 80px);
}
</style>