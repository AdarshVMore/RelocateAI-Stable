import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import FloatingChatButton from './components/FloatingChatButton';
import Home from './pages/Home';
import NeighborhoodFinder from './pages/NeighborhoodFinder';
import PlaceRecommender from './pages/PlaceRecommender';
import RelocationAssistant from './pages/RelocationAssistant';
import SocialConnector from './pages/SocialConnector';
import Login from './pages/Login';  
import './styles/global.css';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/place-recommender" element={<NeighborhoodFinder />} />
              <Route path="/places" element={<PlaceRecommender />} />
              <Route path="/relocation-assistant" element={<RelocationAssistant />} />
              <Route path="/social-connector" element={<SocialConnector />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>
          <FloatingChatButton />
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;