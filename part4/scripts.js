document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Récupérer email et password du formulaire
            const email = loginForm.email.value;
            const password = loginForm.password.value;

            // Appeler la fonction de login
            await loginUser(email, password);
        });
    }
});
async function loginUser(email, password) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = '';  // Reset message d'erreur

    try {
        const response = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
                const data = await response.json();
                document.cookie = `token=${data.access_token}; path=/; SameSite=Lax;`;
                console.log("Cookies after setting:", document.cookie);
                window.location.href = 'index.html';
            }else {
            // Récupérer un message d'erreur plus précis si disponible
            let errorText = response.statusText;
            try {
                const errData = await response.json();
                if (errData.error) errorText = errData.error;
            } catch (_) {}
            errorDiv.textContent = 'Login failed: ' + errorText;
        }
    } catch (error) {
        errorDiv.textContent = 'Network error: ' + error.message;
    }
}
