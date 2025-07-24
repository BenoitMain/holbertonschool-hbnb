// ===== INITIALISATION DE LA PAGE =====
document.addEventListener('DOMContentLoaded', () => {
    // Gestion du formulaire de connexion
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            await loginUser(email, password);
        });
    }

    // Gestion du bouton déconnexion
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            logout();
        });
    }

    // Page d'accueil (index.html)
    if (document.getElementById('places-list')) {
        checkAuthentication();
        setupPriceFilter();
        updateUIBasedOnAuth();
    }

    // Page de détails d'une place (place.html)
    if (document.getElementById('place-details')) {
        initializePlaceDetailsPage();
    }

    // Page add_review.html - Charger les infos dynamiquement
    if (document.getElementById('place-title') && document.getElementById('place-host')) {
        checkAuthentication();
        loadPlaceInfoForReview();
    }

    // ✅ NOUVEAU : Formulaire d'avis SEULEMENT pour add_review.html
    if (document.getElementById('review-form') && !document.getElementById('place-details')) {
        checkAuthentication();
        if (!isLoggedIn()) {
            window.location.href = 'index.html';
        } else {
            const placeId = getPlaceIdFromURL();
            const reviewForm = document.getElementById('review-form');

            reviewForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                // IDs pour add_review.html
                const reviewElement = document.getElementById('review');
                const ratingElement = document.getElementById('rating');

                if (!reviewElement || !ratingElement) {
                    alert('Form elements not found');
                    return;
                }

                const reviewText = reviewElement.value;
                const rating = ratingElement.value;
                if (typeof(reviewText != String)) {
                    alert('Must be a text');
                }
                if (!reviewText.trim() || !rating) {
                    alert('Please fill in all fields');
                    return;
                }

                try {
                    await submitReview(placeId, reviewText, rating);
                    alert('Review submitted successfully!');
                    reviewForm.reset();
                    window.location.href = 'index.html';
                } catch (error) {
                    alert('Failed to submit review: ' + error.message);
                }
            });
        }
    }
});

// ===== AUTHENTIFICATION =====

// Connexion utilisateur
async function loginUser(email, password) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = '';

    try {
        const response = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            // Sauvegarder le token dans les cookies
            document.cookie = `token=${data.access_token}; path=/; SameSite=Lax;`;
            console.log("Cookies after setting:", document.cookie);
            window.location.href = 'index.html';
        } else {
            // Afficher l'erreur de connexion
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

// Récupérer un cookie par son nom
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Vérifier si l'utilisateur est connecté
function isLoggedIn() {
    return getCookie('token') !== null;
}

// Faire une requête avec le token d'authentification
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

    // Fusionner les options avec les headers par défaut
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

// Déconnexion utilisateur
function logout() {
    // Supprimer le token
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    console.log('🚪 Utilisateur déconnecté');
    window.location.reload();
}

// Vérifier l'authentification et mettre à jour l'interface
function checkAuthentication() {
    const token = getCookie('token');
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');

    if (!token) {
        // Utilisateur non connecté
        if (loginLink) loginLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'none';
        console.log('👤 Utilisateur non connecté');
    } else {
        // Utilisateur connecté
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';
        console.log('✅ Utilisateur connecté avec token:', token.substring(0, 20) + '...');
    }

    // Charger les places
    fetchPlaces();
}

// Mettre à jour l'interface selon l'état de connexion
function updateUIBasedOnAuth() {
    const loginButton = document.querySelector('.login-button');

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
    } else {
        // Utilisateur non connecté
        if (loginButton) {
            loginButton.textContent = 'Login';
            loginButton.href = 'login.html';
            loginButton.removeEventListener('click', logout);
        }
    }
}

// ===== GESTION DES PLACES =====

// Récupérer la liste des places depuis l'API
async function fetchPlaces() {
    try {
        console.log('Fetching places...');

        // Essayer avec authentification
        const response = await authenticatedFetch('http://127.0.0.1:5000/api/v1/places/');

        if (response.ok) {
            const places = await response.json();
            console.log('Places fetched:', places);

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

        // Essayer sans authentification
        try {
            console.log('Trying to fetch places without authentication...');
            const response = await fetch('http://127.0.0.1:5000/api/v1/places/');

            if (response.ok) {
                const places = await response.json();
                console.log('✅ Places fetched without auth:', places);

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

// Afficher la liste des places
function displayPlaces(places) {
    const placesList = document.getElementById('places-list');

    if (!placesList) {
        console.error('Element #places-list not found');
        return;
    }

    placesList.innerHTML = '';

    if (!places || places.length === 0) {
        placesList.innerHTML = '<p>No places available</p>';
        return;
    }

    // Créer une carte pour chaque place
    places.forEach(place => {
        const placeDiv = document.createElement('div');
        placeDiv.className = 'place-card';
        placeDiv.setAttribute('data-price', place.price_per_night || place.price || 0);

        placeDiv.innerHTML = `
            <h3>${place.title || place.name || 'Unnamed Place'}</h3>
            <p>${place.description || 'No description available'}</p>
            <p>Location: ${place.city || place.location || 'Unknown'}</p>
            <p>Price: $${place.price_per_night || place.price || 0}/night</p>
            <button class="details-button" onclick="viewPlaceDetails('${place.id || 'mock-' + Math.random()}')">View Details</button>
        `;

        placesList.appendChild(placeDiv);
    });

    console.log(`Displayed ${places.length} places`);
}

// Afficher des places factices (fallback)
function displayMockPlaces() {
    const mockPlaces = [
        {
            id: 'mock-tokyo',
            title: 'Tokyo Villa on beach',
            description: 'Beautiful villa with ocean view',
            city: 'Tokyo',
            price: 150,
            price_per_night: 150
        },
        {
            id: 'mock-paris',
            title: 'Paris Apartment',
            description: 'Cozy apartment in city center',
            city: 'Paris',
            price: 100,
            price_per_night: 100
        }
    ];

    displayPlaces(mockPlaces);
    console.log('📊 Displayed mock places data');
}

// Naviguer vers les détails d'une place
function viewPlaceDetails(placeId) {
    console.log(`🔍 Viewing details for place: ${placeId}`);
    window.location.href = `place.html?id=${placeId}`;
}

// ===== FILTRE PAR PRIX =====

// Configurer le filtre de prix
function setupPriceFilter() {
    const priceFilter = document.getElementById('price-filter');

    if (!priceFilter) {
        console.error('price-filter element not found');
        return;
    }

    priceFilter.innerHTML = '';

    // Options de filtre
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

    // Écouter les changements de filtre
    priceFilter.addEventListener('change', (event) => {
        const selectedPrice = event.target.value;
        console.log('Filter changed to:', selectedPrice);
        filterPlacesByPrice(selectedPrice);
    });

    console.log('Price filter setup complete');
}

// Filtrer les places par prix
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

// ===== DÉTAILS D'UNE PLACE =====

// Récupérer l'ID de la place depuis l'URL
function getPlaceIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Récupérer les détails d'une place
async function fetchPlaceDetails(placeId) {
    try {
        console.log(`🔍 Fetching details for place: ${placeId}`);

        let response;
        try {
            response = await authenticatedFetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        } catch (authError) {
            response = await fetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        }

        if (response.ok) {
            const place = await response.json();
            console.log('✅ Place details fetched:', place);
            displayPlaceDetails(place);
            fetchPlaceReviews(placeId);
        } else {
            console.error('Failed to fetch place details:', response.statusText);
            displayMockPlaceDetails(placeId);
        }
    } catch (error) {
        console.error('Error fetching place details:', error);
        displayMockPlaceDetails(placeId);
    }
}

// Afficher les détails d'une place
function displayPlaceDetails(place) {
    const placeDetails = document.getElementById('place-details');

    if (!placeDetails) {
        console.error('Element #place-details not found');
        return;
    }

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

        <!-- Formulaire d'ajout d'avis (affiché seulement si connecté) -->
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

    setupReviewForm(place.id);
    console.log(`✅ Displayed details for place: ${place.title || place.name}`);
}

// Afficher des détails factices (fallback)
function displayMockPlaceDetails(placeId) {
    const mockPlace = {
        id: placeId,
        title: 'Sample Place',
        description: 'This is a sample place when API is unavailable',
        price: 75,
        price_per_night: 75,
        city: 'Sample City',
        host_name: 'Sample Host',
        owner_name: 'Sample Host',
        amenities: ['WiFi', 'Kitchen', 'Parking']
    };

    displayPlaceDetails(mockPlace);
    console.log('📊 Displayed mock place details for:', placeId);
}

// Initialiser la page de détails
function initializePlaceDetailsPage() {
    const placeId = getPlaceIdFromURL();

    if (!placeId) {
        document.getElementById('place-details').innerHTML = '<p>No place ID provided</p>';
        return;
    }

    console.log(`🏠 Initializing place details page for ID: ${placeId}`);
    updateUIBasedOnAuth();
    fetchPlaceDetails(placeId);
}

// ===== AVIS =====

// Soumettre un avis
async function submitReview(placeId, reviewText, rating) {
    try {
        console.log('📝 Submitting review to database:', {
            place_id: placeId,
            text: reviewText,
            rating: parseInt(rating)
        });

        const response = await authenticatedFetch('http://127.0.0.1:5000/api/v1/reviews/', {
            method: 'POST',
            body: JSON.stringify({
                place_id: placeId,
                text: reviewText,
                rating: parseInt(rating)
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Review saved to database:', data);
            return data;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit review');
        }
    } catch (error) {
        console.error('❌ Database error:', error);
        throw error;
    }
}

// Récupérer les avis d'une place
async function fetchPlaceReviews(placeId) {
    try {
        console.log(`📝 Fetching reviews for place: ${placeId}`);

        const reviewsUrl = `http://127.0.0.1:5000/api/v1/reviews/places/${placeId}/reviews`;

        let response;
        try {
            response = await authenticatedFetch(reviewsUrl);
        } catch (authError) {
            response = await fetch(reviewsUrl);
        }

        if (response.ok) {
            const reviews = await response.json();
            console.log('✅ Reviews fetched from database:', reviews);
            displayReviews(reviews);
        } else if (response.status === 404) {
            console.log('📝 No reviews found for this place');
            displayReviews([]);
        } else {
            console.log('No reviews endpoint or empty reviews');
            displayMockReviews();
        }
    } catch (error) {
        console.error('Error fetching reviews:', error);
        displayMockReviews();
    }
}

// Afficher les avis
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewsList) return;

    console.log('🔍 DEBUG - Reviews structure:', reviews);
    if (reviews.length > 0) {
        console.log('🔍 DEBUG - First review:', reviews[0]);
        console.log('🔍 DEBUG - Available keys:', Object.keys(reviews[0]));
    }

    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
        return;
    }

    reviewsList.innerHTML = reviews.map(review => {
        console.log('🔍 Review rating:', review.rating, typeof review.rating);

        return `
            <div class="review-card">
                <div class="review-header">
                    <strong>User ${review.first_name }</strong>
                    <span class="rating">${review.rating ? '⭐'.repeat(review.rating) : '⭐⭐⭐'}</span>
                </div>
                <p class="review-text">${review.text || 'No text provided'}</p>
                <small class="review-date">
                    ${review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Unknown date'}
                </small>
            </div>
        `;
    }).join('');

    console.log(`✅ Displayed ${reviews.length} real reviews from database`);
}

// Afficher des avis factices (fallback)
function displayMockReviews() {
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewsList) return;

    const mockReviews = [
        {
            id: 'mock-1',
            text: 'Great place to stay! Very clean and comfortable.',
            rating: 5,
            user_name: 'John Doe'
        },
        {
            id: 'mock-2',
            text: 'Nice location but a bit noisy at night.',
            rating: 3,
            user_name: 'Jane Smith'
        }
    ];

    reviewsList.innerHTML = mockReviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <strong>${review.user_name}</strong>
                <span class="rating">${'⭐'.repeat(review.rating)}</span>
            </div>
            <p class="review-text">${review.text}</p>
        </div>
    `).join('');

    console.log('📝 Displayed mock reviews');
}

// Configurer le formulaire d'avis
function setupReviewForm(placeId) {
    const reviewForm = document.getElementById('review-form');
    const addReviewSection = document.getElementById('add-review');

    if (!reviewForm) return;

    // ✅ Vérifier l'authentification et afficher le formulaire
    if (isLoggedIn()) {
        if (addReviewSection) {
            addReviewSection.style.display = 'block';
        }
    } else {
        if (addReviewSection) {
            addReviewSection.style.display = 'none';
        }
        return; // Ne pas configurer le formulaire si pas connecté
    }

    // ✅ Configurer l'event listener pour la soumission
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
            reviewForm.reset();
            fetchPlaceReviews(placeId);
            alert('Review submitted successfully!');
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again.');
        }
    });

    console.log('✅ Review form configured for place:', placeId);
}

// Charger les infos de la place pour add_review.html
async function loadPlaceInfoForReview() {
    const placeId = getPlaceIdFromURL();
    if (!placeId) return;

    try {
        const response = await authenticatedFetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        if (response.ok) {
            const place = await response.json();

            const titleElement = document.getElementById('place-title');
            const hostElement = document.getElementById('place-host');

            if (titleElement) {
                titleElement.textContent = `Review for: ${place.title || place.name}`;
            }
            if (hostElement) {
                hostElement.textContent = `Host: ${place.host_name || place.owner_name || 'Unknown Host'}`;
            }
        }
    } catch (error) {
        console.log('Could not load place info:', error);
    }
}
