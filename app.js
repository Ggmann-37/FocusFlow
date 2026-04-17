const body = document.body;
const loader = document.getElementById('loader');
const themeToggle = document.getElementById('themeToggle');
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form');

const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');

const registerForm = document.getElementById('registerForm');
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regPassword2 = document.getElementById('regPassword2');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');

const examForm = document.getElementById('examForm');
const examName = document.getElementById('examName');
const studyStart = document.getElementById('studyStart');
const examDate = document.getElementById('examDate');
const examError = document.getElementById('examError');
const examList = document.getElementById('examList');

let currentUser = {
  username: 'demo',
  email: 'demo@focusflow.com',
  password: '123456'
};

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  body.classList.add('dark');
  themeToggle.textContent = '☀️ Modo claro';
}

window.addEventListener('load', () => {
  setTimeout(() => {
    loader.classList.add('hidden');
  }, 700);
});

themeToggle.addEventListener('click', () => {
  body.classList.toggle('dark');
  const dark = body.classList.contains('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  themeToggle.textContent = dark ? '☀️ Modo claro' : '🌙 Modo oscuro';
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    forms.forEach((f) => f.classList.remove('active'));

    tab.classList.add('active');
    const target = document.getElementById(`${tab.dataset.tab}Form`);
    target.classList.add('active');

    loginError.textContent = '';
    registerError.textContent = '';
    registerSuccess.textContent = '';
  });
});

registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  registerError.textContent = '';
  registerSuccess.textContent = '';

  if (!registerForm.checkValidity()) {
    registerError.textContent = 'Completa todos los campos correctamente.';
    return;
  }

  if (regPassword.value !== regPassword2.value) {
    registerError.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  currentUser = {
    username: regUsername.value.trim(),
    email: regEmail.value.trim().toLowerCase(),
    password: regPassword.value
  };

  registerSuccess.textContent = 'Cuenta creada. Ya puedes iniciar sesión.';
  registerForm.reset();
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loginError.textContent = '';

  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;

  if (!loginForm.checkValidity()) {
    loginError.textContent = 'Rellena e-mail y contraseña.';
    return;
  }

  if (email !== currentUser.email || password !== currentUser.password) {
    loginError.textContent = 'Contraseña incorrecta o e-mail no registrado.';
    return;
  }

  loginError.textContent = 'Inicio de sesión correcto.';
  loginError.style.color = 'var(--success)';
  setTimeout(() => {
    loginError.textContent = '';
    loginError.style.color = 'var(--danger)';
  }, 1300);
});

examForm.addEventListener('submit', (event) => {
  event.preventDefault();
  examError.textContent = '';

  if (!examForm.checkValidity()) {
    examError.textContent = 'Completa los datos del examen.';
    return;
  }

  const start = new Date(studyStart.value);
  const exam = new Date(examDate.value);

  if (start > exam) {
    examError.textContent = 'La fecha de estudio no puede ser posterior al examen.';
    return;
  }

  const item = document.createElement('li');
  item.innerHTML = `
    <strong>${examName.value.trim()}</strong><br />
    Inicio de estudio: <b>${studyStart.value}</b><br />
    Examen: <b>${examDate.value}</b>
  `;
  examList.prepend(item);
  examForm.reset();
});
