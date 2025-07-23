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

    // Code pour la page d'index
    checkAuthentication();
    setupPriceFilter();

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

function checkAuthentication() {
    const token = getCookie('token');
    const loginLink = document.getElementById('login-link');

    if (!token) {
        // Utilisateur non connecté : montrer le lien de login
        if (loginLink) {
            loginLink.style.display = 'block';
        }
        console.log('👤 Utilisateur non connecté - Affichage du lien de connexion');
    } else {
        // Utilisateur connecté : cacher le lien de login
        if (loginLink) {
            loginLink.style.display = 'none';
        }
        console.log('✅ Utilisateur connecté avec token:', token.substring(0, 20) + '...');
    }

    // TOUJOURS appeler fetchPlaces() - elle gère l'auth en interne
    fetchPlaces();
}
function displayPlaces(places) {
    const placesList = document.getElementById('places-list');

    if (!placesList) {
        console.error('Element places-list not found');
        return;
    }

    // Vider le contenu actuel
    placesList.innerHTML = '';

    // Vérifier si on a des places à afficher
    if (!places || places.length === 0) {
        placesList.innerHTML = '<p>No places available</p>';
        return;
    }

    // Pour chaque place, créer un élément
    places.forEach(place => {
        const placeDiv = document.createElement('div');
        placeDiv.className = 'place-card';

        // IMPORTANT : ajouter l'attribut data-price pour le filtrage
        placeDiv.setAttribute('data-price', place.price_per_night || place.price || 0);

        // Définir le contenu HTML
        placeDiv.innerHTML = `
            <h3>${place.title || place.name || 'Unnamed Place'}</h3>
            <p>${place.description || 'No description available'}</p>
            <p>Location: ${place.city || place.location || 'Unknown'}</p>
            <p>Price: $${place.price_per_night || place.price || 0}/night</p>
        `;

        // Ajouter à la liste
        placesList.appendChild(placeDiv);
    });

    console.log(`Displayed ${places.length} places`);
}
async function fetchPlaces() {
    try {
        console.log('Fetching places...');

        // Option 1: Requête authentifiée
        const response = await authenticatedFetch('http://127.0.0.1:5000/api/v1/places/');

        if (response.ok) {
            const places = await response.json();
            console.log('Places fetched:', places);
            displayPlaces(places);
        } else {
            console.error('Failed to fetch places:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching places:', error);

        // Option 2: Si l'authentification échoue, essayer sans token
        try {
            console.log('Trying to fetch places without authentication...');
            const response = await fetch('http://127.0.0.1:5000/api/v1/places/');

            if (response.ok) {
                const places = await response.json();
                console.log('✅ Places fetched without auth:', places);
                displayPlaces(places);
            } else {
                console.error('Failed to fetch places without auth:', response.statusText);

                // AJOUT : Données mockées si l'API ne fonctionne pas
                console.log('📊 Using mock data as fallback');
                const mockPlaces = [
                    {
                        id: "1",
                        title: "Budget Room Bangkok",
                        description: "Affordable room perfect for backpackers",
                        price_per_night: 25,
                        city: "Bangkok"
                    },
                    {
                        id: "2",
                        title: "Paris Apartment",
                        description: "Beautiful apartment in the heart of Paris",
                        price_per_night: 85,
                        city: "Paris"
                    },
                    {
                        id: "3",
                        title: "Tokyo House",
                        description: "Traditional Japanese house with modern amenities",
                        price_per_night: 120,
                        city: "Tokyo"
                    },
                    {
                        id: "4",
                        title: "NYC Luxury Loft",
                        description: "Modern loft in Manhattan with stunning views",
                        price_per_night: 200,
                        city: "New York"
                    }
                ];
                displayPlaces(mockPlaces);
            }
        } catch (fallbackError) {
            console.error('Fallback fetch also failed:', fallbackError);

            // AJOUT : Dernière option - données mockées
            console.log('🎯 Using mock data as last resort');
            const mockPlaces = [
                {
                    id: "1",
                    title: "Budget Room Bangkok",
                    description: "Affordable room perfect for backpackers",
                    price_per_night: 25,
                    city: "Bangkok"
                },
                {
                    id: "2",
                    title: "Paris Apartment",
                    description: "Beautiful apartment in the heart of Paris",
                    price_per_night: 85,
                    city: "Paris"
                }
            ];
            displayPlaces(mockPlaces);
        }
    }
}
function setupPriceFilter() {
    const priceFilter = document.getElementById('price-filter');

    if (!priceFilter) {
        console.error('price-filter element not found');
        return;
    }

    // Vider les options existantes
    priceFilter.innerHTML = '';

    // Créer les options selon l'énoncé : 10, 50, 100, All
    const options = [
        { value: 'all', text: 'All' },
        { value: '10', text: '10' },
        { value: '50', text: '50' },
        { value: '100', text: '100' }
    ];

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        priceFilter.appendChild(optionElement);
    });

    // Ajouter l'event listener UNE SEULE FOIS
    priceFilter.addEventListener('change', (event) => {
        const selectedPrice = event.target.value;
        console.log('Filter changed to:', selectedPrice);
        filterPlacesByPrice(selectedPrice);
    });

    console.log('Price filter setup complete');
}

function filterPlacesByPrice(maxPrice) {
    const placeCards = document.querySelectorAll('.place-card');
    let visibleCount = 0;

    placeCards.forEach(card => {
        const placePrice = parseInt(card.dataset.price);

        if (maxPrice === 'all' || placePrice <= parseInt(maxPrice)) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    console.log(`Showing ${visibleCount} places with max price: ${maxPrice}`);
}

