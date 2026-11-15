import { BrowserRouter, Route, Routes } from 'react-router';
import Shell from './layout/Shell.jsx';
import Home from './pages/Home.jsx';
import Live from './pages/Live.jsx';
import Feed from './pages/Feed.jsx';
import Party from './pages/Party.jsx';
import Rewards from './pages/Rewards.jsx';
import Profile from './pages/Profile.jsx';
import Signup from './pages/Signup.jsx';
import Welcome from './pages/Welcome.jsx';
import Member from './pages/Member.jsx';
import Merch from './pages/Merch.jsx';
import Login from './pages/Login.jsx';
import { AuthCallback, NotFound, Stub } from './pages/Misc.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import { ToastProvider } from './state/ToastContext.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="live" element={<Live />} />
              <Route path="feed" element={<Feed />} />
              <Route path="party" element={<Party />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="merch" element={<Merch />} />
              <Route path="profile" element={<Profile />} />
              <Route path="welcome" element={<Welcome />} />
              <Route path="u/:userId" element={<Member />} />
              <Route path="signup" element={<Signup />} />
              <Route path="login" element={<Login />} />
              <Route path="create" element={<Stub title="Create" body="Clip and highlight tools are on the roadmap. For now, share your takes in the feed." />} />
              <Route path="arcade" element={<Stub title="Arcade" body="Mini-games that pay out points are planned for a later release." />} />
              <Route path="auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
