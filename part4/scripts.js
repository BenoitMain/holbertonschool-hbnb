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

    // Formulaire d'avis SEULEMENT pour add_review.html
    if (document.getElementById('review-form') && !document.getElementById('place-details')) {
        checkAuthentication();
        if (!isLoggedIn()) {
            window.location.href = 'index.html';
        } else {
            const placeId = getPlaceIdFromURL();
            const reviewForm = document.getElementById('review-form');

            reviewForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                const reviewElement = document.getElementById('review');
                const ratingElement = document.getElementById('rating');

                if (!reviewElement || !ratingElement) {
                    alert('Form elements not found');
                    return;
                }

                const reviewText = reviewElement.value;
                const rating = ratingElement.value;

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
            document.cookie = `token=${data.access_token}; path=/; SameSite=Lax;`;
            console.log("✅ Login successful, redirecting to index");
            window.location.href = 'index.html';
        } else {
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
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    console.log('🚪 User logged out');
    window.location.reload();
}

// Vérifier l'authentification et mettre à jour l'interface
function checkAuthentication() {
    const token = getCookie('token');
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');

    if (!token) {
        if (loginLink) loginLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'none';
        console.log('👤 User not logged in');
    } else {
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';
        console.log('✅ User logged in with token:', token.substring(0, 20) + '...');
    }

    // Charger les places depuis l'API uniquement
    fetchPlaces();
}

// ===== GESTION DES PLACES =====

// Récupérer la liste des places depuis l'API uniquement
async function fetchPlaces() {
    try {
        console.log('🔍 Fetching places from API...');

        // Essayer avec authentification d'abord
        let response;
        try {
            response = await authenticatedFetch('http://127.0.0.1:5000/api/v1/places/');
            console.log('📡 Using authenticated request');
        } catch (authError) {
            console.log('⚠️  Authentication failed, trying without token...');
            response = await fetch('http://127.0.0.1:5000/api/v1/places/');
        }

        if (response.ok) {
            const places = await response.json();
            console.log('✅ Places fetched from API:', places);
            displayPlaces(places);
        } else {
            console.error('❌ API request failed:', response.status, response.statusText);
            displayError('Failed to load places from server');
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        displayError('Network error - unable to connect to server');
    }
}

// Afficher la liste des places
function displayPlaces(places) {
    const placesList = document.getElementById('places-list');

    if (!placesList) {
        console.error('❌ Element #places-list not found');
        return;
    }

    placesList.innerHTML = '';

    if (!places || places.length === 0) {
        placesList.innerHTML = '<p>No places available</p>';
        console.log('ℹ️  No places to display');
        return;
    }

    places.forEach(place => {
        const placeDiv = document.createElement('div');
        placeDiv.className = 'place-card';
        placeDiv.setAttribute('data-price', place.price_per_night || place.price || 0);

        placeDiv.innerHTML = `
            <h3>${place.title || place.name || 'Unnamed Place'}</h3>
            <p>${place.description || 'No description available'}</p>
            <p>Location: ${place.city || place.location || 'Unknown'}</p>
            <p>Price: $${place.price_per_night || place.price || 0}/night</p>
            <button class="details-button" onclick="viewPlaceDetails('${place.id}')">View Details</button>
        `;

        placesList.appendChild(placeDiv);
    });

    console.log(`✅ Displayed ${places.length} places from API`);
}

// Afficher un message d'erreur
function displayError(message) {
    const placesList = document.getElementById('places-list');
    if (placesList) {
        placesList.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${message}</p>
                <button onclick="fetchPlaces()">Retry</button>
            </div>
        `;
    }
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
        console.error('❌ price-filter element not found');
        return;
    }

    priceFilter.innerHTML = '';

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

    priceFilter.addEventListener('change', (event) => {
        const selectedPrice = event.target.value;
        console.log('🔍 Filter changed to:', selectedPrice);
        filterPlacesByPrice(selectedPrice);
    });

    console.log('✅ Price filter setup complete');
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

    console.log(`✅ Showing ${visibleCount} places with max price: ${maxPrice}`);
}

// ===== DÉTAILS D'UNE PLACE =====

// Récupérer l'ID de la place depuis l'URL
function getPlaceIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Récupérer les détails d'une place depuis l'API
async function fetchPlaceDetails(placeId) {
    try {
        console.log(`🔍 Fetching place details for: ${placeId}`);

        let response;
        try {
            response = await authenticatedFetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        } catch (authError) {
            console.log('⚠️  Auth failed, trying without token...');
            response = await fetch(`http://127.0.0.1:5000/api/v1/places/${placeId}`);
        }

        if (response.ok) {
            const place = await response.json();
            console.log('✅ Place details fetched:', place);
            displayPlaceDetails(place);
            fetchPlaceReviews(placeId);
        } else {
            console.error('❌ Failed to fetch place details:', response.status);
            displayPlaceError('Place not found or server error');
        }
    } catch (error) {
        console.error('❌ Error fetching place details:', error);
        displayPlaceError('Network error - unable to load place details');
    }
}

// Afficher les détails d'une place
function displayPlaceDetails(place) {
    const placeDetails = document.getElementById('place-details');

    if (!placeDetails) {
        console.error('❌ Element #place-details not found');
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

        <!-- Formulaire d'ajout d'avis -->
        <div id="add-review">
            <h3>Add Your Review:</h3>
            <div id="review-login-prompt" style="display: none;">
                <p>Please <a href="login.html">login</a> to submit a review.</p>
            </div>
            <form id="review-form" style="display: none;">
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
    updateReviewFormVisibility();

    console.log(`✅ Displayed details for place: ${place.title || place.name}`);
}

// Afficher une erreur pour les détails de place
function displayPlaceError(message) {
    const placeDetails = document.getElementById('place-details');
    if (placeDetails) {
        placeDetails.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${message}</p>
                <a href="index.html">← Back to Places</a>
            </div>
        `;
    }
}

// Mettre à jour la visibilité du formulaire de review
function updateReviewFormVisibility() {
    const reviewForm = document.getElementById('review-form');
    const loginPrompt = document.getElementById('review-login-prompt');

    if (!reviewForm || !loginPrompt) return;

    if (isLoggedIn()) {
        reviewForm.style.display = 'block';
        loginPrompt.style.display = 'none';
        console.log('✅ Review form shown (user logged in)');
    } else {
        reviewForm.style.display = 'none';
        loginPrompt.style.display = 'block';
        console.log('ℹ️  Login prompt shown (user not logged in)');
    }
}

// Initialiser la page de détails
function initializePlaceDetailsPage() {
    const placeId = getPlaceIdFromURL();

    if (!placeId) {
        document.getElementById('place-details').innerHTML = '<p>❌ No place ID provided</p>';
        return;
    }

    console.log(`🏠 Initializing place details page for ID: ${placeId}`);
    checkAuthentication();
    fetchPlaceDetails(placeId);
}

// ===== AVIS =====

// Soumettre un avis à l'API
async function submitReview(placeId, reviewText, rating) {
    try {
        console.log('📝 Submitting review to API:', {
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
            console.log('✅ Review submitted successfully:', data);
            return data;
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error submitting review:', error);

        if (error.message.includes('token') || error.message.includes('authentication')) {
            if (confirm('Your session has expired. Would you like to log in again?')) {
                window.location.href = 'login.html';
            }
        }

        throw error;
    }
}

// Récupérer les avis d'une place depuis l'API
async function fetchPlaceReviews(placeId) {
    try {
        console.log(`📝 Fetching reviews for place: ${placeId}`);

        // URL corrigée avec slash final
        const reviewsUrl = `http://127.0.0.1:5000/api/v1/reviews/`;

        let response;
        try {
            response = await authenticatedFetch(reviewsUrl);
        } catch (authError) {
            response = await fetch(reviewsUrl);
        }

        if (response.ok) {
            const allReviews = await response.json();

            // Filtrer les reviews pour cette place spécifique
            const placeReviews = allReviews.filter(review => review.place_id === placeId);

            console.log(`✅ Reviews fetched from API for place ${placeId}:`, placeReviews);
            displayReviews(placeReviews);
        } else if (response.status === 404) {
            console.log('ℹ️  No reviews found for this place');
            displayReviews([]);
        } else {
            console.error('❌ Failed to fetch reviews:', response.status);
            displayReviewsError('Unable to load reviews');
        }
    } catch (error) {
        console.error('❌ Error fetching reviews:', error);
        displayReviewsError('Network error - unable to load reviews');
    }
}

// Afficher les avis
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewsList) return;

    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
        return;
    }

    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <strong>${review.first_name || review.user_name || 'Anonymous'}</strong>
                <span class="rating">${review.rating ? '⭐'.repeat(review.rating) : '⭐⭐⭐'}</span>
            </div>
            <p class="review-text">${review.text || 'No text provided'}</p>
            <small class="review-date">
                ${review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Unknown date'}
            </small>
        </div>
    `).join('');

    console.log(`✅ Displayed ${reviews.length} reviews from API`);
}

// Afficher une erreur pour les reviews
function displayReviewsError(message) {
    const reviewsList = document.getElementById('reviews-list');
    if (reviewsList) {
        reviewsList.innerHTML = `<p>⚠️ ${message}</p>`;
    }
}

// Configurer le formulaire d'avis
function setupReviewForm(placeId) {
    const reviewForm = document.getElementById('review-form');

    if (!reviewForm || !isLoggedIn()) return;

    // Supprimer les anciens event listeners
    const newForm = reviewForm.cloneNode(true);
    reviewForm.parentNode.replaceChild(newForm, reviewForm);

    newForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const reviewText = document.getElementById('review-text').value.trim();
        const rating = document.getElementById('review-rating').value;

        if (!reviewText || !rating) {
            alert('Please fill in all fields');
            return;
        }

        if (reviewText.length < 10) {
            alert('Please write a review with at least 10 characters');
            return;
        }

        const submitButton = newForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        try {
            await submitReview(placeId, reviewText, parseInt(rating));
            newForm.reset();
            fetchPlaceReviews(placeId);
            alert('Review submitted successfully!');
        } catch (error) {
            alert('Failed to submit review: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
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
        console.log('⚠️  Could not load place info:', error);
    }
}
