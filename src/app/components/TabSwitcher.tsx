import { FaThLarge, FaCamera, FaEdit } from "react-icons/fa";

export const TabSwitcher = ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) => {
  const tabs = [
    { label: "Layout", icon: <FaThLarge /> },
    { label: "Camera", icon: <FaCamera /> },
    { label: "Edit", icon: <FaEdit /> },
  ];

  return (
    <div className="flex justify-center space-x-4">
      {tabs.map(({ label, icon }) => (
        <button
          key={label}
          onClick={() => setActiveTab(label)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${
            activeTab === label
              ? "bg-[#C8A2C8] text-white shadow-md"
              : "bg-white text-[#A47CA4] border border-[#C8A2C8] hover:bg-[#E6DAF8]"
          }`}
          
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
};