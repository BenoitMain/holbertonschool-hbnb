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

    // Mettre à jour l'UI selon l'état de connexion au chargement
    updateUIBasedOnAuth();
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
        } else {
            // Récupérer un message d'erreur plus précis si disponible
            let errorText = response.statusText;
            try {
                const errData = await response.json();
                if (errData.error) errorText = errData.error;
            } catch (_) { }
            errorDiv.textContent = 'Login failed: ' + errorText;
        }
    } catch (error) {
        errorDiv.textContent = 'Network error: ' + error.message;
    }
}

// Fonction pour récupérer le token depuis les cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Fonction pour vérifier si l'utilisateur est connecté
function isLoggedIn() {
    return getCookie('token') !== null;
}

// Fonction générique pour les requêtes avec token
async function authenticatedFetch(url, options = {}) {
    const token = getCookie('token');

    if (!token) {
        throw new Error('No authentication token found');
    }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    // Merge options avec les headers par défaut
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    return fetch(url, finalOptions);
}

// Exemple d'utilisation pour soumettre un avis
async function submitReview(placeId, reviewText, rating) {
    try {
        const response = await authenticatedFetch('http://127.0.0.1:5000/api/v1/reviews', {
            method: 'POST',
            body: JSON.stringify({
                place_id: placeId,
                text: reviewText,
                rating: rating
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Review submitted successfully:', data);
            return data;
        } else {
            throw new Error('Failed to submit review');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        throw error;
    }
}

// Fonction de logout
function logout() {
    // Supprimer le cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

    // Mettre à jour l'interface
    updateUIBasedOnAuth();

    // Rediriger vers la page d'accueil
    window.location.href = 'index.html';
}

// Fonction pour mettre à jour l'interface selon l'état de connexion
function updateUIBasedOnAuth() {
    const loginButton = document.querySelector('.login-button');
    const addReviewSection = document.getElementById('add-review');

    if (isLoggedIn()) {
        // Utilisateur connecté
        if (loginButton) {
            loginButton.textContent = 'Logout';
            loginButton.href = '#';
            loginButton.addEventListener('click', function (e) {
                e.preventDefault();
                logout();
            });
        }

        // Afficher le formulaire d'ajout d'avis si on est sur place.html
        if (addReviewSection) {
            addReviewSection.style.display = 'block';
        }
    } else {
        // Utilisateur non connecté
        if (loginButton) {
            loginButton.textContent = 'Login';
            loginButton.href = 'login.html';
            // Retirer l'event listener de logout
            loginButton.removeEventListener('click', logout);
        }

        // Cacher le formulaire d'ajout d'avis
        if (addReviewSection) {
            addReviewSection.style.display = 'none';
        }
    }
}
