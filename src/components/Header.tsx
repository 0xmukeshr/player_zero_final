import { Bell, Sword, User } from "lucide-react";
import { useAudio } from "../hooks/useAudio";
import { useStarknetConnect } from "../dojo/hooks/useStarknetConnect";

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const { playSound } = useAudio();

  const { status, address, isConnecting, handleConnect, handleDisconnect } =
    useStarknetConnect();

  const navItems = [
    { id: "home", label: "Home" },
    { id: "games", label: "Games" },
    { id: "profile", label: "Profile" },
  ];

  // Helper function to format address
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="bg-pixel-dark-gray pixel-panel border-pixel-gray border-b-4 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-10 h-10 bg-pixel-primary pixel-avatar">
            <Sword className="w-6 h-6 text-pixel-black" />
          </div>
          <h1 className="text-pixel-lg font-bold text-pixel-primary uppercase tracking-wider">
            Player Zero
          </h1>
        </div>

        <nav className="flex items-center space-x-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                playSound("rollover");
                onNavigate(item.id);
              }}
              className={`px-4 py-2 pixel-nav-item text-pixel-sm font-bold uppercase tracking-wider ${
                currentPage === item.id
                  ? "bg-pixel-primary text-pixel-black active"
                  : "text-pixel-primary hover:text-pixel-black hover:bg-pixel-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="pixel-notification bg-pixel-secondary border-pixel-black w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-pixel-warning transition-colors">
              <Bell className="w-4 h-4 text-pixel-black" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-pixel-error pixel-avatar"></div>
          </div>

          {/* Wallet Connection Status */}
          {isConnecting ? (
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-pixel-gray pixel-avatar flex items-center justify-center animate-pulse">
                <User className="w-5 h-5 text-pixel-light-gray" />
              </div>
              <div className="hidden md:block">
                <div className="text-pixel-xs font-bold text-pixel-primary uppercase">
                  Connecting...
                </div>
              </div>
            </div>
          ) : status === "connected" && address ? (
            <div className="flex items-center space-x-2">
              <div
                className="w-10 h-10 bg-pixel-primary pixel-avatar flex items-center justify-center cursor-pointer hover:bg-pixel-secondary transition-colors"
                onClick={handleDisconnect}
                title="Click to disconnect"
              >
                <User className="w-5 h-5 text-pixel-black" />
              </div>
              <div className="hidden md:block">
                <div className="text-pixel-xs font-bold text-pixel-primary uppercase">
                  {formatAddress(address)}
                </div>
                <div className="text-pixel-xs text-pixel-light-gray uppercase">
                  Connected
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-auto px-2 h-10 bg-pixel-gray pixel-avatar flex items-center justify-center cursor-pointer hover:bg-pixel-primary hover:text-pixel-black transition-colors"
              onClick={handleConnect}
              title="Click to connect wallet"
            >
              Connect
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 
