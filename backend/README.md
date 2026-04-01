# Football Field Booking API

Backend API for the Football Field Booking Application.

## 🚀 **PROJECT STATUS: PRODUCTION READY**

✅ **Complete API with all endpoints working**  
✅ **Full frontend-backend integration**  
✅ **Comprehensive error handling**  
✅ **Security features implemented**  
✅ **Database models and associations**  
✅ **Team management with member operations**  
✅ **Public team access endpoints**  
✅ **Database seeding utility**  
✅ **Enhanced validation and security**  

---

## 🛠️ **Tech Stack**
- **Node.js** & **Express** - Server framework
- **MySQL** & **Sequelize ORM** - Database and ORM
- **JWT** - Authentication tokens
- **Express Validator** - Input validation
- **Express Rate Limit** - API rate limiting
- **Helmet** - Security headers
- **Compression** - Performance optimization
- **bcryptjs** - Password hashing

---

## 📁 **Project Structure**

```
backend/
├── src/
│   ├── controllers/          # Route handlers
│   │   ├── authController.js      # Authentication logic
│   │   ├── userController.js      # User management
│   │   ├── fieldController.js     # Field management
│   │   ├── bookingController.js   # Booking operations
│   │   ├── teamController.js       # Team management & member operations
│   │   ├── publicTeamController.js  # Public team access
│   │   ├── ratingController.js     # Rating system
│   │   ├── dashboardController.js  # Dashboard statistics
│   ├── routes/              # API routes
│   ├── middleware/          # Custom middleware
│   ├── models/              # Sequelize models
│   ├── config/              # Configuration files
│   └── utils/               # Utility functions
├── server.js                # Main server file
├── package.json
└── README.md
```

---

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
npm install
```

### **2. Environment Setup**
Create a `.env` file:
```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=football_booking

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# Google Sign-In
GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Development Settings
RATE_LIMITING=true
LOG_LEVEL=dev
```

### **3. Database Setup**
```sql
CREATE DATABASE football_booking;
```

### **4. Start Server**
```bash
npm run dev
```

**🎉 Server will start on http://localhost:5000**

---

## 📚 **API Documentation**

### **🔐 Authentication**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/request-field-owner` - Player submits data (fieldName, location, phone?, description?) to request field-owner role

### **👥 Users**
- `GET /api/users` - List users (Admin only)
- `GET /api/users/:id` - Get user details

### **⚽ Fields**
- `GET /api/fields` - List all fields
- `GET /api/fields/:id` - Get field details
- `POST /api/fields` - Create field (Admin/Owner)
- `PUT /api/fields/:id` - Update field (Admin/Owner)
- `DELETE /api/fields/:id` - Delete field (Admin/Owner)

### **📅 Bookings**
- `GET /api/bookings` - List bookings (Protected)
- `GET /api/bookings/:id` - Get booking details
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking status

### **👥 Teams**
- `GET /api/teams` - List teams (Protected)
- `GET /api/teams/:id` - Get team details
- `POST /api/teams` - Create team (Captain/Admin)
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team
- `POST /api/teams/:id/join` - Request to join team (players)
- `POST /api/teams/:id/leave` - Leave a team (members)
- `GET /api/teams/:id/members` - List team members
- `GET /api/teams/:id/requests` - Captain/admin view pending join requests
- `POST /api/teams/:id/members` - Add member directly (captain/admin)
- `POST /api/teams/:id/invite` - Invite a player to join (captain/admin)
- `POST /api/teams/:id/invite/accept` - Accept a team invitation (invitee)
- `POST /api/teams/:id/invite/decline` - Decline a team invitation (invitee)

### **⭐ Ratings**
- `GET /api/ratings` - List ratings (Protected)
- `GET /api/ratings/:id` - Get rating details
- `POST /api/ratings` - Create rating
- `PUT /api/ratings/:id` - Update rating
- `DELETE /api/ratings/:id` - Delete rating

### **📊 Dashboard**
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/search` - Search resources

---

## 🔐 **Security Features**

- **🛡️ JWT Authentication** - Secure token-based auth
- **📋 Input Validation** - Comprehensive validation with express-validator
- **🚦 Rate Limiting** - Different limits for different endpoints
- **🔒 Security Headers** - Helmet middleware protection
- **🌐 CORS Protection** - Configurable CORS settings
- **🔐 Password Hashing** - bcrypt for secure password storage
- **⚠️ Error Handling** - Standardized error responses

---

## 👥 **User Roles & Permissions**

| Role | Permissions |
|------|-------------|
| **Guest** | View public fields and teams |
| **Player** | Book fields, join teams, manage profile |
| **Captain** | Create/manage teams, book fields |
| **Field Owner** | Manage fields, view field bookings |
| **Admin** | Full system access |

---

## 📊 **Rate Limiting**

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 1000 requests | 15 minutes |
| Authentication | 1000 requests | 15 minutes |
| Search | 300 requests | 1 minute |
| Creation | 100 requests | 1 minute |

---

## 🔧 **Environment Variables**

### **Required**
- `NODE_ENV` - Application environment
- `PORT` - Server port
- `JWT_SECRET` - JWT secret key (min 32 chars)
- `DB_HOST` - Database host
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `GOOGLE_CLIENT_ID` - Google OAuth web client ID used to validate Google sign-in tokens

### **Optional**
- `DB_PORT` - Database port (default: 3306)
- `JWT_EXPIRES_IN` - Token expiration (default: 7d)
- `CORS_ORIGIN` - Allowed origins
- `RATE_LIMITING` - Enable rate limiting (default: true)
- `LOG_LEVEL` - Logging level

---

## 🐛 **Error Response Format**

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "status": 400
}
```

---

## 🧪 **Testing**

### **Seed Data**
Run the seed script to populate the database:
```bash
npm run seed
```

### **Test Credentials**
- **Admin**: `admin@example.com` / `Password123`
- **Field Owner**: `owner@example.com` / `Password123`
- **Player**: `player@example.com` / `Password123`

---

## 🚀 **Deployment**

### **Production Setup**
1. Set `NODE_ENV=production`
2. Use a production database
3. Configure proper CORS origins
4. Set secure JWT secret
5. Enable all security features

### **Docker Support**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## 📝 **Development Notes**

- **Database Sync**: Uses Sequelize sync for development
- **Hot Reload**: Use `npm run dev` for development
- **Logging**: Comprehensive logging with Morgan
- **API Documentation**: Available at `/` endpoint
- **Health Check**: Available at `/health`

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 **License**

This project is licensed under the MIT License.

---

## 🎯 **API Status**

✅ **All endpoints tested and working**  
✅ **Frontend integration complete**  
✅ **Error handling implemented**  
✅ **Security features active**  
✅ **Production ready**

**🚀 Ready for production deployment!**
