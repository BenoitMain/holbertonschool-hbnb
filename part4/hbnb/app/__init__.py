from flask import Flask
from flask_cors import CORS
from flask_restx import Api
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from datetime import timedelta  # Add this import for JWT token expiration
from hbnb.app.extensions import db

# Initialize Flask extensions globally
# These will be configured later in the create_app function
bcrypt = Bcrypt()  # Password hashing extension
jwt = JWTManager()  # JWT token management extension

def create_app(config_class="config.DevelopmentConfig"):
    """
    Application factory pattern to create and configure Flask app instance

    Args:
        config_class (str): Configuration class to use (Development, Production, etc.)

    Returns:
        Flask: Configured Flask application instance
    """
    # Create Flask application instance
    app = Flask(__name__)

    # Load configuration from specified config class
    app.config.from_object(config_class)

    # Configure JWT token expiration to 1 hour (instead of default 15 minutes)
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

    # Enable Cross-Origin Resource Sharing (CORS) for API endpoints
    # This allows frontend running on different ports to access the API
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize extensions with the app instance
    bcrypt.init_app(app)  # Initialize password hashing
    jwt.init_app(app)     # Initialize JWT token management
    db.init_app(app)      # Initialize database connection

    # Import API namespaces (blueprints for different resource endpoints)
    from hbnb.app.api.v1.users import api as users_ns
    from hbnb.app.api.v1.amenities import api as amenities_ns
    from hbnb.app.api.v1.places import api as places_ns
    from hbnb.app.api.v1.reviews import api as review_ns
    from hbnb.app.api.v1.auth import api as auth_ns
    from hbnb.app.api.v1.protected import api as protected_ns

    # Configure Swagger UI authorization for API testing
    # This adds a "Bearer Token" input field in Swagger interface
    authorizations = {
        'Bearer': {
            'type': 'apiKey',           # Type of authentication
            'in': 'header',             # Token sent in HTTP header
            'name': 'Authorization',    # Header name
            'description': 'Enter: Bearer <your_token>'  # User instruction
        }
    }

    # Create Flask-RESTX API instance with Swagger documentation
    api = Api(
        app,
        version='1.0',                      # API version
        title='HBnB API',                   # API title in Swagger
        description='HBnB Application API', # API description in Swagger
        authorizations=authorizations,      # Add Bearer token support
        security='Bearer'                   # Enable security globally
    )

    # Register API namespaces with their URL prefixes
    # Each namespace handles a specific resource type
    api.add_namespace(users_ns, path='/api/v1/users')          # User management endpoints
    api.add_namespace(amenities_ns, path='/api/v1/amenities')  # Amenity management endpoints
    api.add_namespace(places_ns, path='/api/v1/places')        # Place management endpoints
    api.add_namespace(review_ns, path='/api/v1/reviews')       # Review management endpoints
    api.add_namespace(auth_ns, path='/api/v1/auth')            # Authentication endpoints
    api.add_namespace(protected_ns, path='/api/v1/protected')  # Protected/admin endpoints

    # Return the configured Flask application
    return app
