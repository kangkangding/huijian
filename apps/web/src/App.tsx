import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Shell } from "./components/Shell";
import { Account } from "./pages/Account";
import { Auth } from "./pages/Auth";
import { Chat } from "./pages/Chat";
import { Gallery } from "./pages/Gallery";
import { Home } from "./pages/Home";
import { AcceptableUse, Privacy, Terms } from "./pages/Legal";
import { Pricing } from "./pages/Pricing";
import { Studio } from "./pages/Studio";
import { VideoPage } from "./pages/VideoPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/forgot" element={<Auth mode="forgot" />} />
            <Route path="/reset" element={<Auth mode="reset" />} />
            <Route path="/verify" element={<Auth mode="verify" />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/video" element={<VideoPage />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/acceptable-use" element={<AcceptableUse />} />
            <Route path="/account" element={<Account />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
