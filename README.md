# Chat Application 💬

A real-time chat application built with the MERN stack (MongoDB, Express.js, React, Node.js) featuring Socket.io for real-time messaging, Cloudinary for image uploads, and JWT authentication.

## 🌟 Features

- **Real-time Messaging**: Instant message delivery using Socket.io for text, images, audio, and video
- **Voice and Video Calling**: Real-time voice and video calls with call status tracking (answered, missed, duration)
- **User Authentication**: Secure JWT-based authentication system
- **Multimedia Sharing**: Upload and share images, audio, and video via Cloudinary integration
- **Online Status**: See when users are online/offline in real-time
- **Message Read Receipts**: Know when your messages have been seen
- **Message Deletion**: Delete messages for yourself or for everyone
- **User Profiles**: Customizable profiles with bios, names, and profile pictures
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Secure**: Password hashing with bcrypt, protected routes, rate limiting, and CORS

## 🛠️ Tech Stack

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.io** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Cloudinary** - Image storage and management
- **CORS** - Cross-origin resource sharing

### Frontend (Assuming React)

- **React** - UI framework
- **React Router** - Navigation
- **Socket.io-client** - Real-time client
- **Axios** - HTTP requests
- **Context API** - State management

## 📦 Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB installation
- Cloudinary account for image storage

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chat-app/server
   ```
