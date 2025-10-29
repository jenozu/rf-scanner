import { Camera, Home, Zap, ClipboardCheck, Settings } from "lucide-react";
import { PageType } from "../types";

interface FooterNavProps {
  currentPage: PageType;
  setPage: (page: PageType) => void;
}

export default function FooterNav({ currentPage, setPage }: FooterNavProps) {
  const navItems = [
    { page: "home" as PageType, icon: Home, label: "Home", emoji: "🏠" },
    { page: "transactions" as PageType, icon: Zap, label: "Transactions", emoji: "⚡" },
    { page: "scan" as PageType, icon: Camera, label: "Scan", emoji: "🔍" },
    { page: "inventory" as PageType, icon: ClipboardCheck, label: "Inventory", emoji: "🔢" },
    { page: "settings" as PageType, icon: Settings, label: "Settings", emoji: "⚙️" },
  ];

  return (
    <footer className="fixed bottom-0 left-0 w-full bg-white shadow-lg flex justify-around py-2 border-t border-gray-200">
      {navItems.map(({ page, icon: Icon, label, emoji }) => (
        <button
          key={page}
          onClick={() => setPage(page)}
          className={`flex flex-col items-center transition-colors ${
            currentPage === page ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <Icon size={20} />
          <span className="text-xs mt-1">{label}</span>
        </button>
      ))}
    </footer>
  );
}
