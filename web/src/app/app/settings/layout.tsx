import { SettingsNav } from "@/components/app/settings-nav";

export default function SettingsLayout({
  children,
}: LayoutProps<"/app/settings">) {
  return (
    <div>
      <h1 className="display mb-1 text-[1.75rem] sm:text-[2rem]">Settings</h1>
      <SettingsNav />
      {children}
    </div>
  );
}
