'use client';

import { useState } from "react";
import { TabSwitcher } from "./components/TabSwitcher";
import LayoutTab from "./components/LayoutTab";
import CameraTab from "./components/CameraTab"
import EditTab from "./components/EditTabs";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("Camera");

  return (
<main className="min-h-screen bg-[#E6DAF8] text-black p-6">
  <h2 className="text-3xl font-bold text-center mb-6 text-[#A47CA4]">Ramon</h2>


      <TabSwitcher activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Layout" && <LayoutTab />}
        {activeTab === "Camera" && <CameraTab />}
        {activeTab === "Edit" && <EditTab />}
      </div>
    </main>
  );
}
