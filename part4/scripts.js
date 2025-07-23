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

    // Gestion du bouton logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            logout();
        });
    }

    // Code pour la page d'index
    if (document.getElementById('places-list')) {
        checkAuthentication();
        setupPriceFilter();

        // Mettre à jour l'UI selon l'état de connexion au chargement
        updateUIBasedOnAuth();
    }
    if (document.getElementById('place-details')) {
        initializePlaceDetailsPage();
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
    // Supprimer le token des cookies
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

    console.log('🚪 Utilisateur déconnecté');

    // Recharger la page pour mettre à jour l'interface
    window.location.reload();
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

// Mise à jour de la fonction checkAuthentication
function checkAuthentication() {
    const token = getCookie('token');
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');

    if (!token) {
        // Utilisateur non connecté : montrer login, cacher logout
        if (loginLink) {
            loginLink.style.display = 'block';
        }
        if (logoutLink) {
            logoutLink.style.display = 'none';
        }
        console.log('👤 Utilisateur non connecté - Affichage du lien de connexion');
    } else {
        // Utilisateur connecté : cacher login, montrer logout
        if (loginLink) {
            loginLink.style.display = 'none';
        }
        if (logoutLink) {
            logoutLink.style.display = 'block';
        }
        console.log('✅ Utilisateur connecté avec token:', token.substring(0, 20) + '...');
    }

    // TOUJOURS appeler fetchPlaces() - elle gère l'auth en interne
    fetchPlaces();
}
function displayPlaces(places) {
    const placesList = document.getElementById('places-list');

    if (!placesList) {
        console.error('Element #places-list not found');
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

        // Définir le contenu HTML avec le bouton View Details
        placeDiv.innerHTML = `
            <h3>${place.title || place.name || 'Unnamed Place'}</h3>
            <p>${place.description || 'No description available'}</p>
            <p>Location: ${place.city || place.location || 'Unknown'}</p>
            <p>Price: $${place.price_per_night || place.price || 0}/night</p>
            <button class="details-button" onclick="viewPlaceDetails('${place.id || 'mock-' + Math.random()}')">View Details</button>
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

            // AJOUTEZ CETTE VÉRIFICATION 👇
            if (places && places.length > 0) {
                displayPlaces(places);
            } else {
                console.log('API returned empty array, using mock data');
                displayMockPlaces();
            }
        } else {
            console.error('Failed to fetch places:', response.statusText);
            displayMockPlaces();
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

                // AJOUTEZ CETTE VÉRIFICATION AUSSI 👇
                if (places && places.length > 0) {
                    displayPlaces(places);
                } else {
                    console.log('API returned empty array, using mock data');
                    displayMockPlaces();
                }
            } else {
                console.error('Failed to fetch places without auth:', response.statusText);
                displayMockPlaces();
            }
        } catch (fallbackError) {
            console.error('Fallback fetch also failed:', fallbackError);
            displayMockPlaces();
        }
    }
}

// AJOUTEZ CETTE NOUVELLE FONCTION 👇
function displayMockPlaces() {
    const mockPlaces = [
        {
            id: "1",
            title: "Budget Room Bangkok",
            description: "Affordable room perfect for backpackers in the heart of Bangkok.",
            price_per_night: 25,
            city: "Bangkok",
            host_name: "Somchai Thai"
        },
        {
            id: "2",
            title: "Paris Luxury Apartment",
            description: "Beautiful apartment near la Tour Eiffel avec une vue imprenable sur la ville.",
            price_per_night: 85,
            city: "Paris",
            host_name: "Marie Dubois"
        },
        {
            id: "3",
            title: "Tokyo Modern House",
            description: "Traditional Japanese house with modern amenities in Shibuya.",
            price_per_night: 120,
            city: "Tokyo",
            host_name: "Takeshi Yamamoto"
        },
        {
            id: "4",
            title: "NYC Luxury Loft",
            description: "Modern loft in Manhattan with stunning views of Central Park.",
            price_per_night: 200,
            city: "New York",
            host_name: "Jennifer Smith"
        }
    ];

    console.log('📊 Using mock data as fallback');
    displayPlaces(mockPlaces);
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

// Fonction pour naviguer vers les détails d'une place
function viewPlaceDetails(placeId) {
    console.log(`🔍 Viewing details for place: ${placeId}`);
    window.location.href = `place.html?id=${placeId}`;
}

// ===== TASK 3: PLACE DETAILS FUNCTIONS =====

/**
 * Extract place ID from URL parameters
 * @returns {string|null} Place ID or null if not found
 */
function getPlaceIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

/**
 * Fetch detailed information for a specific place
 * @param {string} placeId - The ID of the place to fetch
 */
async function fetchPlaceDetails(placeId) {
    try {
        console.log(`🔍 Fetching details for place: ${placeId}`);

        // Try with authentication first
        let response;
        try {
            response = await authenticatedFetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        } catch (authError) {
            // If authentication fails, try without token
            console.log('Authentication failed, trying without token...');
            response = await fetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        }

        if (response.ok) {
            const place = await response.json();
            console.log('✅ Place details fetched:', place);
            displayPlaceDetails(place);

            // Also fetch reviews for this place
            fetchPlaceReviews(placeId);
        } else {
            console.error('Failed to fetch place details:', response.statusText);
            // Fallback to mock data
            displayMockPlaceDetails(placeId);
        }
    } catch (error) {
        console.error('Error fetching place details:', error);
        // Fallback to mock data
        displayMockPlaceDetails(placeId);
    }
}

/**
 * Display place details on the page
 * @param {Object} place - Place object with details
 */
function displayPlaceDetails(place) {
    const placeDetails = document.getElementById('place-details');

    if (!placeDetails) {
        console.error('Element #place-details not found');
        return;
    }

    // Get price from various possible field names
    const price = place.price_per_night || place.price || place.cost_per_night || 0;

    placeDetails.innerHTML = `
        <div class="place-info">
            <h1>${place.title || place.name || 'Unnamed Place'}</h1>
            <p class="description">${place.description || 'No description available'}</p>
            <div class="place-meta">
                <p class="price"><strong>Price:</strong> $${price}/night</p>
                <p class="location"><strong>Location:</strong> ${place.city || place.location || 'Unknown'}</p>
                <p class="host"><strong>Host:</strong> ${place.host_name || place.owner_name || 'Unknown Host'}</p>
            </div>

            <div class="amenities">
                <h3>Amenities:</h3>
                <ul>
                    ${place.amenities && place.amenities.length > 0
            ? place.amenities.map(amenity => `<li>${amenity}</li>`).join('')
            : '<li>No amenities listed</li>'
        }
                </ul>
            </div>
        </div>

        <div class="reviews-section">
            <h3>Reviews:</h3>
            <div id="reviews-list">
                <p>Loading reviews...</p>
            </div>
        </div>

        <!-- Add review form (only shown if logged in) -->
        <div id="add-review" style="display: none;">
            <h3>Add Your Review:</h3>
            <form id="review-form">
                <div class="form-group">
                    <label for="review-text">Your Review:</label>
                    <textarea id="review-text" rows="4" required placeholder="Share your experience..."></textarea>
                </div>
                <div class="form-group">
                    <label for="review-rating">Rating:</label>
                    <select id="review-rating" required>
                        <option value="">Select rating</option>
                        <option value="1">1 - Poor</option>
                        <option value="2">2 - Fair</option>
                        <option value="3">3 - Good</option>
                        <option value="4">4 - Very Good</option>
                        <option value="5">5 - Excellent</option>
                    </select>
                </div>
                <button type="submit">Submit Review</button>
            </form>
        </div>
    `;

    // Set up review form submission
    setupReviewForm(place.id);

    console.log(`✅ Displayed details for place: ${place.title || place.name}`);
}

/**
 * Fetch reviews for a specific place
 * @param {string} placeId - The ID of the place
 */
async function fetchPlaceReviews(placeId) {
    try {
        console.log(`📝 Fetching reviews for place: ${placeId}`);

        // Try to fetch reviews from API
        let response;
        try {
            response = await authenticatedFetch(`http://127.0.0.1:5000/api/v1/places/${placeId}/reviews`);
        } catch (authError) {
            response = await fetch(`http://127.0.0.1:5000/api/v1/places/${placeId}/reviews`);
        }

        if (response.ok) {
            const reviews = await response.json();
            console.log('✅ Reviews fetched:', reviews);
            displayReviews(reviews);
        } else {
            console.log('No reviews endpoint or empty reviews');
            displayMockReviews(placeId);
        }
    } catch (error) {
        console.error('Error fetching reviews:', error);
        displayMockReviews(placeId);
    }
}

/**
 * Display reviews on the page
 * @param {Array} reviews - Array of review objects
 */
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviews-list');

    if (!reviewsList) {
        console.error('Element #reviews-list not found');
        return;
    }

    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
        return;
    }

    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <strong>${review.user_name || review.author || 'Anonymous'}</strong>
                <span class="rating">★ ${review.rating}/5</span>
            </div>
            <p class="review-text">"${review.text || review.comment || review.content}"</p>
            <p class="review-date">${review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}</p>
        </div>
    `).join('');

    console.log(`✅ Displayed ${reviews.length} reviews`);
}

/**
 * Set up the review form submission
 * @param {string} placeId - The ID of the place
 */
function setupReviewForm(placeId) {
    const reviewForm = document.getElementById('review-form');

    if (!reviewForm) return;

    reviewForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const reviewText = document.getElementById('review-text').value;
        const rating = document.getElementById('review-rating').value;

        if (!reviewText || !rating) {
            alert('Please fill in all fields');
            return;
        }

        try {
            await submitReview(placeId, reviewText, parseInt(rating));

            // Clear form
            reviewForm.reset();

            // Refresh reviews
            fetchPlaceReviews(placeId);

            alert('Review submitted successfully!');
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again.');
        }
    });
}

/**
 * Initialize place details page
 */
function initializePlaceDetailsPage() {
    const placeId = getPlaceIdFromURL();

    if (!placeId) {
        document.getElementById('place-details').innerHTML = '<p>No place ID provided</p>';
        return;
    }

    console.log(`🏠 Initializing place details page for ID: ${placeId}`);

    // Update UI based on authentication status
    updateUIBasedOnAuth();

    // Fetch and display place details
    fetchPlaceDetails(placeId);
}

// ===== MOCK DATA FOR DEVELOPMENT =====

const mockPlaces = {
    "1": {
        id: "1",
        title: "Budget Room Bangkok",
        description: "Affordable room perfect for backpackers in the heart of Bangkok. Close to temples, markets, and nightlife.",
        price_per_night: 25,
        city: "Bangkok",
        host_name: "Somchai Thai",
        amenities: ["WiFi", "Air Conditioning", "Shared Kitchen", "24/7 Reception"]
    },
    "2": {
        id: "2",
        title: "Paris Luxury Apartment",
        description: "Beautiful apartment near the Eiffel Tower with stunning views of the city.",
        price_per_night: 85,
        city: "Paris",
        host_name: "Marie Dubois",
        amenities: ["WiFi", "Full Kitchen", "Balcony", "City View"]
    },
    "3": {
        id: "3",
        title: "Tokyo Modern House",
        description: "Traditional Japanese house with modern amenities in the heart of Shibuya.",
        price_per_night: 120,
        city: "Tokyo",
        host_name: "Takeshi Yamamoto",
        amenities: ["WiFi", "Traditional Bath", "Garden", "Metro Access"]
    },
    "4": {
        id: "4",
        title: "NYC Luxury Loft",
        description: "Modern loft in Manhattan with stunning views of Central Park.",
        price_per_night: 200,
        city: "New York",
        host_name: "Jennifer Smith",
        amenities: ["WiFi", "Gym", "Rooftop Access", "Park View"]
    }
};

const mockReviews = {
    "1": [
        { text: "Great location and very clean!", rating: 5, user_name: "John D.", created_at: "2024-01-15" },
        { text: "Perfect for budget travelers", rating: 4, user_name: "Sarah M.", created_at: "2024-01-10" }
    ],
    "2": [
        { text: "Amazing view and great location!", rating: 5, user_name: "Mike R.", created_at: "2024-01-20" }
    ],
    "3": [
        { text: "Authentic Japanese experience", rating: 4, user_name: "David K.", created_at: "2024-01-12" }
    ],
    "4": [
        { text: "Incredible place, worth every penny!", rating: 5, user_name: "Lisa W.", created_at: "2024-01-22" }
    ]
};

/**
 * Fallback function to display mock place details
 */
function displayMockPlaceDetails(placeId) {
    const place = mockPlaces[placeId];
    if (place) {
        console.log('📊 Using mock place details');
        displayPlaceDetails(place);
        displayMockReviews(placeId);
    } else {
        document.getElementById('place-details').innerHTML = '<p>Place not found</p>';
    }
}

/**
 * Display mock reviews for testing
 */
function displayMockReviews(placeId) {
    const reviews = mockReviews[placeId] || [];
    console.log('📊 Using mock reviews');
    displayReviews(reviews);
}

