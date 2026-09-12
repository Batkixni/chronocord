import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Save,
  User,
  CalendarDays,
  Users,
  ChevronLeft,
  Shield,
  Sun,
  Moon,
  Search,
  CheckSquare,
  Square,
  Menu,
  X,
  LogOut,
  Settings,
  Clock,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Video,
  Tag,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  Eye,
  EyeOff,
  Calendar,
  Server,
  Check,
  Mail,
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOTAL_SLOTS = 32;

function fmt(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ─── Helpers ─── */
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Status Dot ─── */
function StatusDot({ status }) {
  const color =
    status === "online"
      ? "var(--status-online)"
      : status === "busy"
        ? "var(--status-busy)"
        : status === "away"
          ? "var(--status-away)"
          : "var(--status-offline)";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: color }}
    />
  );
}

/* ─── Badge ─── */
function Badge({ children, variant = "info" }) {
  const map = {
    info: { bg: "var(--tag-info-bg)", text: "var(--tag-info-text)" },
    green: { bg: "var(--tag-green-bg)", text: "var(--tag-green-text)" },
    red: { bg: "var(--tag-red-bg)", text: "var(--tag-red-text)" },
    gray: { bg: "var(--tag-gray-bg)", text: "var(--tag-gray-text)" },
  };
  const v = map[variant] || map.info;
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: v.bg, color: v.text }}
    >
      {children}
    </span>
  );
}

/* ─── Tab Pill ─── */
function TabPill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-[13px] font-medium px-3.5 py-1.5 rounded-full transition shrink-0"
      style={{
        background: active ? "var(--card-bg)" : "transparent",
        color: active ? "var(--text)" : "var(--text-secondary)",
        border: active ? "1px solid var(--border)" : "1px solid transparent",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
      }}
    >
      {children}
    </button>
  );
}

/* ─── Inner Card (gray bg like reference sub-cards) ─── */
function InnerCard({ children, className = "" }) {
  return (
    <div
      className={cn("rounded-[var(--radius-lg)] p-3", className)}
      style={{ background: "var(--card-inner-bg)" }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════
   APP
   ═══════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [view, setView] = useState("calendar");
  const [meetings, setMeetings] = useState([]);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? saved === "true" : false;
  });
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [mainOpen, setMainOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser);
    fetch("/api/guilds")
      .then((r) => (r.ok ? r.json() : []))
      .then(setGuilds);
  }, []);

  if (!user) {
    return (
      <div
        className="h-screen flex items-center justify-center px-4"
        style={{ background: "var(--sidebar-bg)" }}
      >
        <div
          className="rounded-2xl p-10 max-w-sm w-full text-center space-y-7"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <CalendarDays className="w-7 h-7" style={{ color: "#FFFFFF" }} />
          </div>
          <div>
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Regulus
            </h1>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Please log in to configure your availability
            </p>
          </div>
          <a
            href="/auth/discord"
            className="inline-flex items-center justify-center gap-2 w-full text-white text-sm font-medium py-2.5 rounded-xl transition"
            style={{ background: "var(--accent)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent)")
            }
          >
            <User className="w-4 h-4" />
            Login with Discord
          </a>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      label: "Main",
      items: [
        { id: "calendar", label: "My Availability", icon: CalendarDays },
        { id: "meetings", label: "My Meetings", icon: Video },
      ],
    },
    {
      label: "Account",
      items: [{ id: "settings", label: "Settings", icon: Settings }],
    },
  ];

  const viewLabel =
    view === "calendar"
      ? "My Availability"
      : view === "meetings"
        ? "My Meetings"
        : view === "guild-members"
          ? "Members"
          : view === "guild-calendar"
            ? "Calendar"
            : "Settings";

  return (
    <div
      className="h-screen flex flex-col md:flex-row"
      style={{ color: "var(--text)" }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile header */}
      <div
        className="md:hidden shrink-0 px-4 py-3 flex items-center justify-between"
        style={{
          background: "var(--sidebar-bg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ color: "var(--text)" }}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <CalendarDays className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
            Regulus
          </span>
        </div>
        <img
          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
          alt=""
          className="w-8 h-8 rounded-full"
          style={{ border: "1px solid var(--border)" }}
        />
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-50 h-full flex flex-col transition-all duration-200 md:translate-x-0",
          "w-60",
          sidebarCollapsed && "md:w-[68px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div
          className={cn(
            "pt-5 pb-3 flex items-center gap-3",
            sidebarCollapsed ? "px-5 md:px-3 md:justify-center" : "px-5",
          )}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent)" }}
          >
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1
                className="text-[16px] font-bold truncate tracking-tight"
                style={{ color: "var(--text)" }}
              >
                Regulus
              </h1>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto w-6 h-6 rounded flex items-center justify-center"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Collapse toggle + avatar row — desktop only */}
        <div
          className={cn(
            "pb-3 hidden md:flex items-center gap-2",
            sidebarCollapsed ? "px-3 justify-center" : "px-5",
          )}
        >
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition"
            style={{
              color: "var(--text-secondary)",
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
            }}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
          {!sidebarCollapsed && (
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
              alt=""
              className="w-7 h-7 rounded-full ml-auto"
              style={{ border: "1px solid var(--border)" }}
            />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto min-w-0">
          {/* ── Server Dropdown ── */}
          <div className="pb-2">
            <button
              onClick={() =>
                !sidebarCollapsed && setServerDropdownOpen((o) => !o)
              }
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl border transition",
                sidebarCollapsed
                  ? "px-3 py-2.5 md:justify-center md:px-2"
                  : "px-3 py-2.5",
              )}
              style={{
                background: "var(--card-bg)",
                borderColor: serverDropdownOpen
                  ? "var(--accent)"
                  : "var(--border)",
                color: "var(--text)",
              }}
              title={
                sidebarCollapsed
                  ? selectedGuild?.name || "Select Server"
                  : undefined
              }
            >
              {selectedGuild ? (
                selectedGuild.icon ? (
                  <img
                    src={selectedGuild.icon}
                    alt=""
                    className="w-5 h-5 rounded-md shrink-0"
                  />
                ) : (
                  <div
                    className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {selectedGuild.name.slice(0, 1)}
                  </div>
                )
              ) : (
                <Server
                  className="w-4 h-4 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
              {!sidebarCollapsed && (
                <>
                  <span
                    className="flex-1 text-left text-[13px] font-medium truncate"
                    style={{
                      color: selectedGuild
                        ? "var(--text)"
                        : "var(--text-muted)",
                    }}
                  >
                    {selectedGuild ? selectedGuild.name : "Select Server"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-transform",
                      serverDropdownOpen && "rotate-180",
                    )}
                    style={{ color: "var(--text-muted)" }}
                  />
                </>
              )}
            </button>

            {serverDropdownOpen && !sidebarCollapsed && (
              <div
                className="mt-1 rounded-xl border overflow-hidden"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                }}
              >
                {selectedGuild && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedGuild(null);
                        setView("calendar");
                        setServerDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "var(--card-inner-bg)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span>Clear Selection</span>
                    </button>
                    <div
                      style={{ borderTop: "1px solid var(--border-light)" }}
                    />
                  </>
                )}
                {guilds.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGuild(g);
                      setView("guild-members");
                      setServerDropdownOpen(false);
                      setMobileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition"
                    style={{
                      background:
                        selectedGuild?.id === g.id
                          ? "var(--card-inner-bg)"
                          : "transparent",
                      color: "var(--text)",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedGuild?.id !== g.id)
                        e.currentTarget.style.background =
                          "var(--card-inner-bg)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedGuild?.id !== g.id)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {g.icon ? (
                      <img
                        src={g.icon}
                        alt=""
                        className="w-5 h-5 rounded-md shrink-0"
                      />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: "var(--accent)", color: "#fff" }}
                      >
                        {g.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="flex-1 truncate">{g.name}</span>
                    {selectedGuild?.id === g.id && (
                      <Check
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: "var(--accent)" }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Guild nav items (shown when a guild is selected) ── */}
          {selectedGuild && (
            <div className="pb-2">
              {!sidebarCollapsed && (
                <div
                  className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {selectedGuild.name}
                </div>
              )}
              <div className="space-y-0.5">
                {[
                  { id: "guild-members", label: "Members", icon: Users },
                  { id: "guild-calendar", label: "Calendar", icon: Calendar },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition",
                      sidebarCollapsed
                        ? "px-3 py-2 md:justify-center md:px-2"
                        : "px-3 py-2",
                    )}
                    style={{
                      background:
                        view === item.id ? "var(--card-bg)" : "transparent",
                      color:
                        view === item.id
                          ? "var(--text)"
                          : "var(--text-secondary)",
                      border:
                        view === item.id
                          ? "1px solid var(--border)"
                          : "1px solid transparent",
                    }}
                    title={item.label}
                  >
                    <item.icon
                      className="w-4 h-4 shrink-0"
                      strokeWidth={view === item.id ? 2.5 : 2}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* divider */}
          <div
            className="border-t my-1"
            style={{ borderColor: "var(--border-light)" }}
          />

          {/* Main dropdown */}
          <div>
            {!sidebarCollapsed ? (
              <button
                onClick={() => setMainOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition"
                style={{ color: "var(--text-muted)" }}
                title="Main"
              >
                <span className="uppercase tracking-[0.08em] text-[10px] font-semibold">
                  Main
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 ml-auto transition-transform",
                    mainOpen && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <div
                className="mx-3 my-2 h-px"
                style={{ background: "var(--border)" }}
              />
            )}
            {mainOpen && (
              <div
                className={cn(
                  "space-y-0.5",
                  sidebarCollapsed ? "mt-1" : "mt-1 pl-0",
                )}
              >
                {navGroups
                  .find((g) => g.label === "Main")
                  ?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setView(item.id);
                        setMobileOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition",
                        sidebarCollapsed
                          ? "px-3 py-2 md:justify-center md:px-2"
                          : "px-3 py-2",
                      )}
                      style={{
                        background:
                          view === item.id ? "var(--card-bg)" : "transparent",
                        color:
                          view === item.id
                            ? "var(--text)"
                            : "var(--text-secondary)",
                        border:
                          view === item.id
                            ? "1px solid var(--border)"
                            : "1px solid transparent",
                      }}
                      title={item.label}
                    >
                      <item.icon
                        className="w-4 h-4 shrink-0"
                        strokeWidth={view === item.id ? 2.5 : 2}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Account dropdown */}
          <div>
            {!sidebarCollapsed ? (
              <button
                onClick={() => setAccountOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition"
                style={{ color: "var(--text-muted)" }}
                title="Account"
              >
                <span className="uppercase tracking-[0.08em] text-[10px] font-semibold">
                  Account
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 ml-auto transition-transform",
                    accountOpen && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <div
                className="mx-3 my-2 h-px"
                style={{ background: "var(--border)" }}
              />
            )}
            {accountOpen && (
              <div
                className={cn(
                  "space-y-0.5",
                  sidebarCollapsed ? "mt-1" : "mt-1 pl-0",
                )}
              >
                {navGroups
                  .find((g) => g.label === "Account")
                  ?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setView(item.id);
                        setMobileOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition",
                        sidebarCollapsed
                          ? "px-3 py-2 md:justify-center md:px-2"
                          : "px-3 py-2",
                      )}
                      style={{
                        background:
                          view === item.id ? "var(--card-bg)" : "transparent",
                        color:
                          view === item.id
                            ? "var(--text)"
                            : "var(--text-secondary)",
                        border:
                          view === item.id
                            ? "1px solid var(--border)"
                            : "1px solid transparent",
                      }}
                      title={item.label}
                    >
                      <item.icon
                        className="w-4 h-4 shrink-0"
                        strokeWidth={view === item.id ? 2.5 : 2}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom: theme toggle */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition",
              sidebarCollapsed
                ? "px-3 py-2 md:justify-center md:px-2"
                : "px-3 py-2",
            )}
            style={{ color: "var(--text-secondary)" }}
            title={theme === "dark" ? "Light Mode" : "Dark Mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            {!sidebarCollapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        style={{ background: "var(--main-bg)" }}
      >
        {/* Top bar */}
        <div
          className="shrink-0 px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span
              className="font-medium truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              Regulus
            </span>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <span className="font-semibold truncate">{viewLabel}</span>
          </div>
          <button
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {(view === "guild-members" || view === "guild-calendar") &&
          selectedGuild ? (
            <GuildView
              key={selectedGuild.id}
              selectedGuild={selectedGuild}
              view={view}
            />
          ) : view === "settings" ? (
            <SettingsView user={user} guilds={guilds} />
          ) : view === "meetings" ? (
            <MeetingsView />
          ) : (
            <CalendarView />
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════
   CalendarView
   ═══════════════════════════════════════ */
function CalendarView() {
  const [slots, setSlots] = useState([]);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [selecting, setSelecting] = useState(true);
  const [saved, setSaved] = useState(false);
  const [labelEditor, setLabelEditor] = useState(null);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setSlots(
          data.map((s) => ({
            day: s.day_of_week,
            start: s.start_minute,
            end: s.end_minute,
            labels: s.labels || [],
          })),
        ),
      );
  }, []);

  const isSelected = useCallback(
    (day, minute) =>
      slots.some((s) => s.day === day && s.start <= minute && s.end > minute),
    [slots],
  );

  const getSlotAt = useCallback(
    (day, minute) =>
      slots.find((s) => s.day === day && s.start <= minute && s.end > minute),
    [slots],
  );

  const addCell = (day, minute) => {
    setSlots((prev) => [
      ...prev.filter(
        (s) => !(s.day === day && s.start <= minute && s.end > minute),
      ),
      { day, start: minute, end: minute + 30, labels: [] },
    ]);
    setSaved(false);
  };

  const removeCell = (day, minute) => {
    setSlots((prev) => {
      const newSlots = [];
      for (const s of prev) {
        if (s.day !== day || s.end <= minute || s.start > minute) {
          newSlots.push(s);
        } else {
          if (s.start < minute) {
            newSlots.push({ ...s, end: minute });
          }
          if (s.end > minute + 30) {
            newSlots.push({ ...s, start: minute + 30 });
          }
        }
      }
      return newSlots;
    });
    setSaved(false);
  };

  const toggleCell = (day, minute) => {
    const currently = isSelected(day, minute);
    if (selecting && !currently) {
      addCell(day, minute);
    } else if (!selecting && currently) {
      removeCell(day, minute);
    }
  };

  const handleMouseDown = (day, minute) => {
    setIsMouseDown(true);
    const currently = isSelected(day, minute);
    setSelecting(!currently);
    if (!currently) {
      addCell(day, minute);
    } else {
      removeCell(day, minute);
    }
  };

  const handleMouseEnterCell = (day, minute) => {
    if (!isMouseDown) return;
    toggleCell(day, minute);
  };

  const handleMouseUp = () => setIsMouseDown(false);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const openLabelEditor = (day, minute) => {
    const slot = getSlotAt(day, minute);
    if (!slot) return;
    setLabelEditor({ day, minute, slot });
    setLabelInput(slot.labels?.join(", ") || "");
  };

  const saveLabels = () => {
    if (!labelEditor) return;
    const { day, minute } = labelEditor;
    const labels = labelInput
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setSlots((prev) =>
      prev.map((s) => {
        if (s.day === day && s.start <= minute && s.end > minute) {
          return { ...s, labels };
        }
        return s;
      }),
    );
    setLabelEditor(null);
    setSaved(false);
  };

  const save = async () => {
    const merged = [];
    for (let d = 0; d < 7; d++) {
      const daySlots = slots
        .filter((s) => s.day === d)
        .sort((a, b) => a.start - b.start);
      const m = [];
      for (const s of daySlots) {
        const last = m[m.length - 1];
        if (
          last &&
          last.end === s.start &&
          JSON.stringify(last.labels) === JSON.stringify(s.labels)
        ) {
          last.end = s.end;
        } else m.push({ ...s });
      }
      if (m.length)
        merged.push(
          ...m.map((s) => ({
            dayOfWeek: d,
            startMinute: s.start,
            endMinute: s.end,
            labels: s.labels || [],
          })),
        );
    }
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: merged }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else alert("Failed to save schedule.");
  };

  const selectedCount = slots.reduce(
    (acc, s) => acc + (s.end - s.start) / 30,
    0,
  );

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 min-w-0">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            My Availability
          </h2>
          <p
            className="text-[13px] mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Click or drag to mark available hours. Right-click selected slots to add tags.
          </p>
        </div>
        <Badge variant="info">
          <Clock className="w-3 h-3 mr-1" />
          {Math.round(selectedCount)} slots
        </Badge>
      </div>

      {/* Calendar Card */}
      <div
        className="flex-1 min-h-0 rounded-[var(--radius-xl)] border overflow-hidden select-none relative"
        style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
      >
        <div
          className="h-full grid gap-px overflow-auto"
          style={{
            gridTemplateColumns: "40px repeat(7, minmax(0, 1fr))",
            gridTemplateRows: `32px repeat(${TOTAL_SLOTS}, minmax(0, 1fr))`,
            background: "var(--border)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{ background: "var(--card-bg)" }}
          />
          {DAYS.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-center text-xs font-semibold select-none"
              style={{ background: "var(--card-bg)", color: "var(--text)" }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: TOTAL_SLOTS }, (_, idx) => {
            const hour = Math.floor(idx / 2) + 8;
            const minOffset = (idx % 2) * 30;
            const minute = hour * 60 + minOffset;
            const showLabel = minOffset === 0;
            return (
              <div key={`row-${idx}`} className="contents">
                <div
                  className="flex items-center justify-end pr-2 text-[10px] font-mono select-none"
                  style={{
                    background: "var(--card-bg)",
                    color: showLabel ? "var(--text-muted)" : "transparent",
                  }}
                >
                  {showLabel ? fmt(minute) : ""}
                </div>
                {DAYS.map((_, day) => {
                  const selected = isSelected(day, minute);
                  const slot = selected ? getSlotAt(day, minute) : null;
                  return (
                    <div
                      key={`${day}-${minute}`}
                      className="transition-colors duration-75 select-none relative"
                      style={{
                        background: selected
                          ? "var(--selected)"
                          : "var(--card-bg)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected)
                          e.currentTarget.style.background =
                            "var(--card-inner-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = selected
                          ? "var(--selected)"
                          : "var(--card-bg)";
                      }}
                      onMouseDown={(e) => {
                        if (e.button === 2) return;
                        handleMouseDown(day, minute);
                      }}
                      onMouseEnter={() => handleMouseEnterCell(day, minute)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selected) openLabelEditor(day, minute);
                      }}
                    >
                      {slot && slot.labels && slot.labels.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center px-0.5">
                          <div className="text-[8px] leading-tight text-center text-white/90 truncate w-full">
                            {slot.labels.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Label Editor Popover */}
        {labelEditor && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setLabelEditor(null)}
          >
            <div
              className="rounded-[var(--radius-xl)] border p-5 w-80"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="text-[15px] font-semibold mb-1"
                style={{ color: "var(--text)" }}
              >
                Edit Tag
              </h3>
              <p
                className="text-[12px] mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                {DAYS[labelEditor.day]} {fmt(labelEditor.minute)}{" "}
                 tags (comma-separated)
              </p>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="e.g. Work, In Meeting"
                className="w-full px-3 py-2 rounded-lg text-[13px] mb-4 outline-none"
                style={{
                  background: "var(--card-inner-bg)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabels();
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={saveLabels}
                  className="flex-1 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition"
                  style={{ background: "var(--accent)" }}
                >
                  Save
                </button>
                <button
                  onClick={() => setLabelEditor(null)}
                  className="flex-1 text-[13px] font-medium px-4 py-2 rounded-xl transition"
                  style={{
                    background: "var(--card-inner-bg)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[13px]">
          <div className="flex items-center gap-2">
            <StatusDot status={saved ? "online" : "offline"} />
            <span
              className="font-medium"
              style={{
                color: saved ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {saved ? "Saved" : "Unsaved changes"}
            </span>
          </div>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <span style={{ color: "var(--text-secondary)" }}>
            Drag to select, right-click to add tags
          </span>
        </div>
        <button
          onClick={save}
          className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition"
          style={{ background: "var(--accent)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--accent)")
          }
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved" : "Save Schedule"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   GuildView
   ═══════════════════════════════════════ */
function GuildView({ selectedGuild, view }) {
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSlots, setMemberSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memberFilter, setMemberFilter] = useState("all");

  const [finderMode, setFinderMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [heatmapData, setHeatmapData] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [eventModal, setEventModal] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    eventDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    priority: "medium",
    tag: "",
    repeatType: "none",
    repeatUntil: "",
  });

  // Load members on mount (component is keyed by guild id, so remounts when guild changes)
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/guilds/${selectedGuild.id}/members`)
      .then((r) =>
        r.ok
          ? r.json()
          : r
              .json()
              .then((d) => Promise.reject(new Error(d.error || "Failed to load"))),
      )
      .then((data) => {
        setMembers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load");
        setLoading(false);
      });
  }, []);

  const loadEvents = async () => {
    if (!selectedGuild) return;
    setEventsLoading(true);
    const res = await fetch(`/api/guilds/${selectedGuild.id}/events`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events || []);
    }
    setEventsLoading(false);
  };

  // Load events when switching to calendar view
  useEffect(() => {
    if (view === "guild-calendar") {
      loadEvents();
    }
  }, [view]);

  const selectMember = async (member) => {
    if (finderMode) return;
    setSelectedMember(member);
    const res = await fetch(
      `/api/guilds/${selectedGuild.id}/members/${member.id}/availability`,
    );
    const data = await res.json();
    setMemberSlots(data);
  };

  const toggleFinderMode = () => {
    const entering = !finderMode;
    setFinderMode(entering);
    setShowMemberPicker(false);
    if (entering) {
      setSelectedMember(null);
      setMemberSlots([]);
      setHeatmapData(null);
    } else {
      setSelectedMembers(new Set());
      setHeatmapData(null);
    }
  };

  const toggleMemberSelection = (memberId) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const findCommonSlots = async () => {
    if (selectedMembers.size === 0) return;
    setHeatmapLoading(true);
    const res = await fetch(
      `/api/guilds/${selectedGuild.id}/members/availability`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedMembers) }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      setHeatmapData(data.results);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Query failed");
    }
    setHeatmapLoading(false);
  };

  const saveEvent = async () => {
    if (!selectedGuild || !eventForm.title || !eventForm.eventDate) return;
    const url =
      eventModal === "new"
        ? `/api/guilds/${selectedGuild.id}/events`
        : `/api/guilds/${selectedGuild.id}/events/${eventForm.id}`;
    const method = eventModal === "new" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventForm),
    });
    if (res.ok) {
      setEventModal(null);
      loadEvents();
    } else {
      alert("Failed to save");
    }
  };

  const deleteEvent = async (eventId) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    const res = await fetch(
      `/api/guilds/${selectedGuild.id}/events/${eventId}`,
      {
        method: "DELETE",
      },
    );
    if (res.ok) {
      loadEvents();
    }
  };

  const openNewEvent = (dateStr) => {
    setEventForm({
      title: "",
      description: "",
      eventDate: dateStr || new Date().toISOString().slice(0, 10),
      endDate: "",
      startTime: "",
      endTime: "",
      priority: "medium",
      tag: "",
      repeatType: "none",
      repeatUntil: "",
    });
    setEventModal("new");
  };

  const openEditEvent = (event) => {
    setEventForm({
      id: event.id,
      title: event.title,
      description: event.description || "",
      eventDate: event.eventDate,
      endDate: event.endDate || "",
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      priority: event.priority,
      tag: event.tag || "",
      repeatType: event.repeatType,
      repeatUntil: event.repeatUntil || "",
    });
    setEventModal("edit");
  };

  const filledCount = members.filter((m) => m.filled).length;
  const filteredMembers = members.filter((m) => {
    if (memberFilter === "filled") return m.filled;
    if (memberFilter === "unfilled") return !m.filled;
    return true;
  });

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 min-w-0">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2
            className="text-lg font-semibold truncate tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {selectedGuild.name}
          </h2>
          <p
            className="text-[13px] mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {view === "guild-members" ? "Member Schedules" : "Server Calendar"}
          </p>
        </div>
        {view === "guild-members" && (
          <button
            onClick={toggleFinderMode}
            className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition shrink-0"
            style={{
              background: finderMode ? "var(--accent)" : "var(--card-inner-bg)",
              color: finderMode ? "#FFFFFF" : "var(--text)",
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {finderMode ? "Exit Resolver" : "Find Common Slots"}
            </span>
          </button>
        )}
        {view === "guild-calendar" && selectedGuild.isAdmin && (
          <button
            onClick={() => openNewEvent()}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition shrink-0"
            style={{ background: "var(--accent)", color: "#FFFFFF" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Event</span>
          </button>
        )}
      </div>

      {/* ── Members view ── */}
      {view === "guild-members" && (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {!finderMode && (
              <>
                <TabPill
                  active={memberFilter === "all"}
                  onClick={() => setMemberFilter("all")}
                >
                  All · {members.length}
                </TabPill>
                <TabPill
                  active={memberFilter === "filled"}
                  onClick={() => setMemberFilter("filled")}
                >
                  Configured · {filledCount}
                </TabPill>
                <TabPill
                  active={memberFilter === "unfilled"}
                  onClick={() => setMemberFilter("unfilled")}
                >
                  Not set · {members.length - filledCount}
                </TabPill>
              </>
            )}
            {finderMode && (
              <>
                <Badge variant="info">{selectedMembers.size} selected</Badge>
                <button
                  onClick={() => setShowMemberPicker(true)}
                  className="md:hidden text-[12px] font-medium px-3 py-1.5 rounded-lg transition shrink-0"
                  style={{ background: "var(--card-inner-bg)", color: "var(--text)" }}
                >
                  Select Members
                </button>
              </>
            )}
            <button
              onClick={toggleFinderMode}
              className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg transition shrink-0"
              style={{
                background: finderMode ? "var(--accent)" : "var(--card-inner-bg)",
                color: finderMode ? "#FFFFFF" : "var(--text)",
              }}
              title={finderMode ? "Exit Resolver" : "Find Common Slots"}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {error ? (
            <div
              className="flex-1 flex items-center justify-center text-[13px]"
              style={{ color: "var(--tag-red-text)" }}
            >
              {error}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[300px_1fr] gap-4 min-w-0">
              {/* Left: Member list */}
              <div
                className="rounded-[var(--radius-xl)] border overflow-hidden flex flex-col min-h-0 min-w-0"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                }}
              >
                {/* Mobile finderMode: compact controls */}
                {finderMode && (
                  <div
                    className="md:hidden shrink-0 px-4 py-3 border-b flex items-center gap-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Badge variant="info">{selectedMembers.size} selected</Badge>
                    <button
                      onClick={() => setShowMemberPicker(true)}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition"
                      style={{ background: "var(--card-inner-bg)", color: "var(--text)" }}
                    >
                      Select Members
                    </button>
                    <button
                      onClick={findCommonSlots}
                      disabled={selectedMembers.size === 0 || heatmapLoading}
                      className="ml-auto inline-flex items-center gap-1 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      style={{ background: "var(--accent)" }}
                    >
                      {heatmapLoading ? "Searching..." : "Find"}
                    </button>
                  </div>
                )}

                <div className={`flex-1 overflow-y-auto min-h-0 min-w-0 ${finderMode ? "hidden md:block" : ""}`}>
                  {loading ? (
                    <div
                      className="p-6 text-[13px] text-center"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Loading...
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div
                      className="p-6 text-[13px] text-center"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No members found
                    </div>
                  ) : (
                    filteredMembers.map((m) => (
                      <div
                        key={m.id}
                        onClick={() =>
                          finderMode
                            ? toggleMemberSelection(m.id)
                            : selectMember(m)
                        }
                        className="flex items-center gap-3 px-4 py-3 text-left transition cursor-pointer min-w-0"
                        style={{
                          background:
                            !finderMode && selectedMember?.id === m.id
                              ? "var(--card-inner-bg)"
                              : "transparent",
                          borderBottom: "1px solid var(--border-light)",
                        }}
                      >
                        {finderMode && (
                          <div
                            className="shrink-0"
                            style={{
                              color: selectedMembers.has(m.id)
                                ? "var(--accent)"
                                : "var(--border)",
                            }}
                          >
                            {selectedMembers.has(m.id) ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </div>
                        )}
                        <img
                          src={m.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full shrink-0"
                          style={{ border: "1px solid var(--border)" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[13px] font-medium truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {m.name}
                          </div>
                        </div>
                        <Badge variant={m.filled ? "green" : "gray"}>
                          {m.filled ? "Configured" : "Not set"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                {finderMode && (
                  <div
                    className="hidden md:block shrink-0 px-4 py-3 border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <button
                      onClick={findCommonSlots}
                      disabled={selectedMembers.size === 0 || heatmapLoading}
                      className="w-full inline-flex items-center justify-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50"
                      style={{ background: "var(--accent)" }}
                    >
                      <Search className="w-4 h-4" />
                      {heatmapLoading ? "Searching..." : "Find Common Availability"}
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Detail panel */}
              <div
                className="rounded-[var(--radius-xl)] border overflow-hidden flex flex-col min-h-0 min-w-0"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                }}
              >
                {finderMode ? (
                  heatmapData ? (
                    <HeatmapPanel data={heatmapData} members={members} />
                  ) : (
                    <div
                      className="flex-1 flex flex-col items-center justify-center gap-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <InnerCard className="w-14 h-14 flex items-center justify-center !p-0">
                        <Search className="w-6 h-6" />
                      </InnerCard>
                      <p className="text-[13px]">
                        Select members and click "Find Common Availability"
                      </p>
                    </div>
                  )
                ) : !selectedMember ? (
                  <div
                    className="flex-1 flex flex-col items-center justify-center gap-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <InnerCard className="w-14 h-14 flex items-center justify-center !p-0">
                      <Users className="w-6 h-6" />
                    </InnerCard>
                    <p className="text-[13px]">Click a member on the left to inspect their availability</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full min-h-0 min-w-0">
                    <div
                      className="shrink-0 px-5 py-4 border-b flex items-center gap-3"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <img
                        src={selectedMember.avatar}
                        alt=""
                        className="w-10 h-10 rounded-full"
                        style={{ border: "1px solid var(--border)" }}
                      />
                      <div className="min-w-0">
                        <div
                          className="text-[15px] font-semibold truncate"
                          style={{ color: "var(--text)" }}
                        >
                          {selectedMember.name}
                        </div>
                        <div
                          className="text-[12px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {selectedMember.filled
                            ? "Availability configured"
                            : "Not configured"}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 min-w-0">
                      {memberSlots.length === 0 ? (
                        <div
                          className="text-[13px] text-center py-10"
                          style={{ color: "var(--text-muted)" }}
                        >
                          No availability configured yet
                        </div>
                      ) : (
                        <TimeTable slots={memberSlots} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Calendar view ── */}
      {view === "guild-calendar" && (
        <GuildCalendarView
          guild={selectedGuild}
          events={events}
          eventsLoading={eventsLoading}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          eventModal={eventModal}
          setEventModal={setEventModal}
          eventForm={eventForm}
          setEventForm={setEventForm}
          onSaveEvent={saveEvent}
          onDeleteEvent={deleteEvent}
          onOpenNewEvent={openNewEvent}
          onOpenEditEvent={openEditEvent}
        />
      )}

      {/* Mobile Member Picker Modal */}
      {showMemberPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setShowMemberPicker(false)}
        >
          <div
            className="w-full rounded-t-[var(--radius-xl)] border p-4 max-h-[80vh] overflow-y-auto"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[15px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Select Members
              </span>
              <button
                onClick={() => setShowMemberPicker(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                style={{ background: "var(--card-inner-bg)", color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  onClick={() => toggleMemberSelection(m.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition"
                  style={{
                    background: selectedMembers.has(m.id)
                      ? "var(--card-inner-bg)"
                      : "transparent",
                  }}
                >
                  <div
                    className="shrink-0"
                    style={{
                      color: selectedMembers.has(m.id)
                        ? "var(--accent)"
                        : "var(--border)",
                    }}
                  >
                    {selectedMembers.has(m.id) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </div>
                  <img
                    src={m.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full shrink-0"
                    style={{ border: "1px solid var(--border)" }}
                  />
                  <span
                    className="text-[13px] font-medium flex-1 truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {m.name}
                  </span>
                  <Badge variant={m.filled ? "green" : "gray"}>
                    {m.filled ? "Configured" : "Not set"}
                  </Badge>
                </div>
              ))}
            </div>
            <div
              className="mt-4 pt-3 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={() => {
                  findCommonSlots();
                  setShowMemberPicker(false);
                }}
                disabled={selectedMembers.size === 0 || heatmapLoading}
                className="w-full text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {heatmapLoading
                  ? "Searching..."
                  : `Find Common Availability (${selectedMembers.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Custom Date Picker ─── */
function CustomDatePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => value ? new Date(value + "T00:00:00") : new Date());

  useEffect(() => {
    function onEsc(e) { if (e.key === "Escape") setOpen(false); }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  const year = pickerMonth.getFullYear();
  const month = pickerMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(dateStr);
    setOpen(false);
  };

  const displayValue = value
    ? `${value.slice(0, 4)}/${value.slice(5, 7)}/${value.slice(8, 10)}`
    : "Select Date";

  return (
    <>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block" style={{ color: "var(--text-muted)" }}>
          {label}
        </label>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full px-3 py-2 rounded-lg text-[13px] text-left flex items-center justify-between transition"
          style={{ background: "var(--card-inner-bg)", color: value ? "var(--text)" : "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          <span>{displayValue}</span>
          <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-[var(--radius-xl)] border p-4 w-72"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setPickerMonth(new Date(year, month - 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center transition" style={{ color: "var(--text-secondary)", background: "var(--card-inner-bg)" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                {new Date(year, month).toLocaleString("en-US", { month: "short", year: "numeric" })}
              </span>
              <button onClick={() => setPickerMonth(new Date(year, month + 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center transition" style={{ color: "var(--text-secondary)", background: "var(--card-inner-bg)" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                if (!day) return <div key={idx} className="w-8 h-8" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = value === dateStr;
                const isTodayDate = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                return (
                  <button
                    key={idx}
                    onClick={() => selectDate(day)}
                    className="w-8 h-8 rounded-full text-[12px] font-medium flex items-center justify-center transition"
                    style={{
                      background: isSelected ? "var(--accent)" : isTodayDate ? "var(--card-inner-bg)" : "transparent",
                      color: isSelected ? "#FFFFFF" : isTodayDate ? "var(--accent)" : "var(--text)",
                      border: isTodayDate && !isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { const t = new Date(); const s = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; onChange(s); setOpen(false); }}
                className="flex-1 text-[12px] font-medium py-2 rounded-lg transition"
                style={{ background: "var(--card-inner-bg)", color: "var(--text-secondary)" }}
              >
                Today
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-[12px] font-medium py-2 rounded-lg transition"
                style={{ background: "var(--card-inner-bg)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Custom Time Picker ─── */
function CustomTimePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [selHour, setSelHour] = useState(value ? value.split(":")[0] : "00");
  const [selMin, setSelMin] = useState(value ? value.split(":")[1] : "00");

  useEffect(() => {
    function onEsc(e) { if (e.key === "Escape") setOpen(false); }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  useEffect(() => {
    if (value) { const [h, m] = value.split(":"); setSelHour(h); setSelMin(m); }
  }, [value]);

  const apply = () => {
    onChange(`${selHour}:${selMin}`);
    setOpen(false);
  };

  const quickTimes = ["08:00", "09:00", "10:00", "12:00", "13:00", "14:00", "15:00", "18:00", "19:00", "20:00"];
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  return (
    <>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block" style={{ color: "var(--text-muted)" }}>
          {label}
        </label>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full px-3 py-2 rounded-lg text-[13px] text-left flex items-center justify-between transition"
          style={{ background: "var(--card-inner-bg)", color: value ? "var(--text)" : "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          <span>{value || "Select Time"}</span>
          <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-[var(--radius-xl)] border p-4 w-64"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[13px] font-semibold mb-3 text-center" style={{ color: "var(--text)" }}>
              Select Time
            </div>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {quickTimes.map((t) => (
                <button
                  key={t}
                  onClick={() => { onChange(t); setOpen(false); }}
                  className="text-[11px] px-2.5 py-1 rounded-md transition"
                  style={{
                    background: value === t ? "var(--accent)" : "var(--card-inner-bg)",
                    color: value === t ? "#FFFFFF" : "var(--text-secondary)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              {/* Hours */}
              <div className="flex-1">
                <div className="text-[11px] font-semibold mb-1.5 text-center" style={{ color: "var(--text-muted)" }}>Hour</div>
                <div className="h-40 overflow-y-auto space-y-0.5 pr-1" style={{ scrollbarWidth: "thin" }}>
                  {hours.map((h) => (
                    <button
                      key={h}
                      onClick={() => setSelHour(h)}
                      className="w-full text-[12px] py-1 rounded transition"
                      style={{
                        background: selHour === h ? "var(--accent)" : "transparent",
                        color: selHour === h ? "#FFFFFF" : "var(--text)",
                      }}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              {/* Minutes */}
              <div className="flex-1">
                <div className="text-[11px] font-semibold mb-1.5 text-center" style={{ color: "var(--text-muted)" }}>Min</div>
                <div className="h-40 overflow-y-auto space-y-0.5 pr-1">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelMin(m)}
                      className="w-full text-[12px] py-1 rounded transition"
                      style={{
                        background: selMin === m ? "var(--accent)" : "transparent",
                        color: selMin === m ? "#FFFFFF" : "var(--text)",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={apply}
                className="flex-1 text-white text-[12px] font-semibold py-2 rounded-lg transition"
                style={{ background: "var(--accent)" }}
              >
                Confirm {selHour}:{selMin}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-[12px] font-medium py-2 rounded-lg transition"
                style={{ background: "var(--card-inner-bg)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════
   GuildCalendarView
   ═══════════════════════════════════════ */
function GuildCalendarView({
  guild,
  events,
  eventsLoading,
  calendarMonth,
  setCalendarMonth,
  eventModal,
  setEventModal,
  eventForm,
  setEventForm,
  onSaveEvent,
  onDeleteEvent,
  onOpenNewEvent,
  onOpenEditEvent,
}) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));
  const goToday = () => setCalendarMonth(new Date());

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events
      .filter((e) => e.instanceDate === dateStr)
      .sort((a, b) => {
        if (!a.startTime) return -1;
        if (!b.startTime) return 1;
        return a.startTime.localeCompare(b.startTime);
      });
  };

  const today = new Date();
  const isToday = (day) =>
    day &&
    today.getDate() === day &&
    today.getMonth() === month &&
    today.getFullYear() === year;

  const priorityColor = {
    low: "var(--tag-green-bg)",
    medium: "var(--accent-light-bg)",
    high: "var(--tag-red-bg)",
  };
  const priorityText = {
    low: "var(--tag-green-text)",
    medium: "var(--accent-light-text)",
    high: "var(--tag-red-text)",
  };
  const priorityBorder = {
    low: "var(--tag-green-text)",
    medium: "var(--accent)",
    high: "var(--tag-red-text)",
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 min-w-0">
      {/* Calendar Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{ background: "var(--card-inner-bg)", color: "var(--text)" }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            className="text-[15px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            {new Date(year, month).toLocaleString("en-US", { month: "short", year: "numeric" })}
          </div>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{ background: "var(--card-inner-bg)", color: "var(--text)" }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition"
          style={{
            background: "var(--card-inner-bg)",
            color: "var(--text-secondary)",
          }}
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className="flex-1 min-h-0 rounded-[var(--radius-xl)] border overflow-hidden flex flex-col"
        style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
      >
        {/* Weekday headers */}
        <div className="grid grid-cols-7 shrink-0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-semibold py-2 border-b"
              style={{
                color: "var(--text-muted)",
                borderColor: "var(--border)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {eventsLoading ? (
          <div
            className="flex-1 flex items-center justify-center text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Loading...
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDate(day);
              return (
                <div
                  key={idx}
                  className="border-b border-r p-1.5 min-h-[80px] transition cursor-pointer"
                  style={{
                    borderColor: "var(--border-light)",
                    background: day ? "var(--card-bg)" : "var(--card-inner-bg)",
                  }}
                  onClick={() =>
                    day &&
                    onOpenNewEvent(
                      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
                    )
                  }
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            "text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full",
                            isToday(day) && "text-white",
                          )}
                          style={{
                            color: isToday(day) ? "#FFFFFF" : "var(--text)",
                            background: isToday(day)
                              ? "var(--accent)"
                              : "transparent",
                          }}
                        >
                          {day}
                        </span>
                        {guild.isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenNewEvent(
                                `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
                              );
                            }}
                            className="opacity-0 hover:opacity-100 transition w-4 h-4 flex items-center justify-center rounded"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id + ev.instanceDate}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            className="text-[9px] px-1.5 py-0.5 rounded truncate cursor-pointer transition hover:opacity-80"
                            style={{
                              background:
                                priorityColor[ev.priority] ||
                                priorityColor.medium,
                              color:
                                priorityText[ev.priority] ||
                                priorityText.medium,
                              borderLeft: `2px solid ${priorityBorder[ev.priority] || priorityBorder.medium}`,
                            }}
                            title={`${ev.title}${ev.startTime ? ` · ${ev.startTime}${ev.endTime ? `~${ev.endTime}` : ""}` : ""}${ev.endDate && ev.endDate !== ev.instanceDate ? ` · until ${ev.endDate}` : ""}${ev.tag ? ` · #${ev.tag}` : ""}`}
                          >
                            {ev.startTime && <span>{ev.startTime} </span>}
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div
                            className="text-[9px] px-1.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Detail Popover */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="rounded-[var(--radius-xl)] border p-5 w-80 max-w-[90vw]"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {selectedEvent.title}
                </h3>
                {selectedEvent.description && (
                  <p
                    className="text-[12px] mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {selectedEvent.description}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  selectedEvent.priority === "high"
                    ? "red"
                    : selectedEvent.priority === "low"
                      ? "green"
                      : "info"
                }
              >
                {selectedEvent.priority === "high"
                  ? "High"
                  : selectedEvent.priority === "low"
                    ? "Low"
                    : "Medium"}
              </Badge>
            </div>
            <div
              className="space-y-2 text-[12px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {selectedEvent.instanceDate}
                  {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.instanceDate
                    ? ` ~ ${selectedEvent.endDate}`
                    : ""}
                </span>
              </div>
              {(selectedEvent.startTime || selectedEvent.endTime) && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {selectedEvent.startTime || "--:--"}
                    {selectedEvent.endTime ? ` ~ ${selectedEvent.endTime}` : ""}
                  </span>
                </div>
              )}
              {selectedEvent.tag && (
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedEvent.tag}</span>
                </div>
              )}
              {selectedEvent.repeatType !== "none" && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {selectedEvent.repeatType === "weekly"
                      ? "Weekly"
                      : "Monthly"}
                    {selectedEvent.repeatUntil
                      ? ` · until ${selectedEvent.repeatUntil}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
            {guild.isAdmin && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setSelectedEvent(null);
                    onOpenEditEvent(selectedEvent);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg transition"
                  style={{
                    background: "var(--card-inner-bg)",
                    color: "var(--text)",
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    setSelectedEvent(null);
                    onDeleteEvent(selectedEvent.id);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg transition"
                  style={{
                    background: "var(--tag-red-bg)",
                    color: "var(--tag-red-text)",
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Modal (New/Edit) */}
      {eventModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setEventModal(null)}
        >
          <div
            className="rounded-[var(--radius-xl)] border p-5 w-[400px] max-w-[90vw] max-h-[90vh] overflow-y-auto"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-[15px] font-semibold mb-4"
              style={{ color: "var(--text)" }}
            >
              {eventModal === "new" ? "New Calendar Event" : "Edit Calendar Event"}
            </h3>
            <div className="space-y-3">
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Title *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                  style={{
                    background: "var(--card-inner-bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                  placeholder="Event Title"
                />
              </div>
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none"
                  style={{
                    background: "var(--card-inner-bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                  placeholder="Event Description (optional)"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CustomDatePicker
                  label="Start Date *"
                  value={eventForm.eventDate}
                  onChange={(v) => setEventForm((f) => ({ ...f, eventDate: v }))}
                />
                <CustomDatePicker
                  label="End Date"
                  value={eventForm.endDate}
                  onChange={(v) => setEventForm((f) => ({ ...f, endDate: v }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CustomTimePicker
                  label="Start Time"
                  value={eventForm.startTime}
                  onChange={(v) => setEventForm((f) => ({ ...f, startTime: v }))}
                />
                <CustomTimePicker
                  label="End Time"
                  value={eventForm.endTime}
                  onChange={(v) => setEventForm((f) => ({ ...f, endTime: v }))}
                />
              </div>
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Tag
                </label>
                <input
                  type="text"
                  value={eventForm.tag}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, tag: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                  style={{
                    background: "var(--card-inner-bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                  placeholder="e.g. Sprint Planning"
                />
              </div>
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Priority
                </label>
                <div className="flex gap-2">
                  {[
                    {
                      value: "low",
                      label: "Low",
                      color: "var(--tag-green-bg)",
                      text: "var(--tag-green-text)",
                    },
                    {
                      value: "medium",
                      label: "Medium",
                      color: "var(--accent-light-bg)",
                      text: "var(--accent-light-text)",
                    },
                    {
                      value: "high",
                      label: "High",
                      color: "var(--tag-red-bg)",
                      text: "var(--tag-red-text)",
                    },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() =>
                        setEventForm((f) => ({ ...f, priority: p.value }))
                      }
                      className="flex-1 text-[12px] font-medium px-3 py-2 rounded-lg transition"
                      style={{
                        background:
                          eventForm.priority === p.value
                            ? p.color
                            : "var(--card-inner-bg)",
                        color:
                          eventForm.priority === p.value
                            ? p.text
                            : "var(--text-secondary)",
                        border:
                          eventForm.priority === p.value
                            ? `1px solid ${p.text}`
                            : "1px solid var(--border)",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Recurring Pattern
                  </label>
                  <select
                    value={eventForm.repeatType}
                    onChange={(e) =>
                      setEventForm((f) => ({
                        ...f,
                        repeatType: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none appearance-none"
                    style={{
                      background: "var(--card-inner-bg)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {eventForm.repeatType !== "none" && (
                  <div>
                    <label
                      className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1 block"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Repeat Until
                    </label>
                    <input
                      type="date"
                      value={eventForm.repeatUntil}
                      onChange={(e) =>
                        setEventForm((f) => ({
                          ...f,
                          repeatUntil: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                      style={{
                        background: "var(--card-inner-bg)",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={onSaveEvent}
                className="flex-1 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition"
                style={{ background: "var(--accent)" }}
              >
                Save
              </button>
              <button
                onClick={() => setEventModal(null)}
                className="flex-1 text-[13px] font-medium px-4 py-2.5 rounded-xl transition"
                style={{
                  background: "var(--card-inner-bg)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TimeTable ─── */
function TimeTable({ slots }) {
  const byDay = {};
  for (const s of slots) {
    const d = s.day_of_week ?? s.day;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(s);
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 min-w-0">
      {DAYS.map((d, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] p-3 border min-w-0"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div
            className="text-xs font-semibold mb-2"
            style={{ color: "var(--text)" }}
          >
            {d}
          </div>
          <div className="space-y-1.5">
            {byDay[i]
              ?.sort(
                (a, b) =>
                  (a.start_minute ?? a.start) - (b.start_minute ?? b.start),
              )
              .map((s, idx) => (
                <div key={idx}>
                  <div
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {fmt(s.start_minute ?? s.start)}~
                    {fmt(s.end_minute ?? s.end)}
                  </div>
                  {s.labels && s.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {s.labels.map((label, li) => (
                        <span
                          key={li}
                          className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: "var(--accent-light-bg)",
                            color: "var(--accent-light-text)",
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )) || (
              <div
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                None
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   HeatmapPanel
   ═══════════════════════════════════════ */
function HeatmapPanel({ data, members }) {
  const [hoverInfo, setHoverInfo] = useState(null);

  const userIds = useMemo(() => Object.keys(data), [data]);
  const maxCount = userIds.length;

  const memberMap = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const { counts, peopleAt } = useMemo(() => {
    const c = Array(7)
      .fill(null)
      .map(() => Array(TOTAL_SLOTS).fill(0));
    const p = Array(7)
      .fill(null)
      .map(() =>
        Array(TOTAL_SLOTS)
          .fill(null)
          .map(() => []),
      );

    for (let day = 0; day < 7; day++) {
      for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
        const minute = (Math.floor(slot / 2) + 8) * 60 + (slot % 2) * 30;
        let count = 0;
        const people = [];
        for (const uid of userIds) {
          const slots = data[uid] || [];
          if (
            slots.some(
              (s) =>
                s.day_of_week === day &&
                s.start_minute <= minute &&
                s.end_minute > minute,
            )
          ) {
            count++;
            people.push(uid);
          }
        }
        c[day][slot] = count;
        p[day][slot] = people;
      }
    }
    return { counts: c, peopleAt: p };
  }, [data, userIds]);

  const getColor = (count) => {
    if (count === 0) return "var(--card-bg)";
    if (count === maxCount) return "var(--selected)";
    const ratio = count / maxCount;
    return `color-mix(in srgb, var(--accent) ${Math.round(ratio * 55)}%, var(--card-bg))`;
  };

  const intersections = useMemo(() => {
    const result = [];
    for (let day = 0; day < 7; day++) {
      let currentStart = null;
      for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
        const minute = (Math.floor(slot / 2) + 8) * 60 + (slot % 2) * 30;
        const allAvailable = counts[day][slot] === maxCount;
        if (allAvailable && currentStart === null) {
          currentStart = minute;
        } else if (!allAvailable && currentStart !== null) {
          result.push({ day, start: currentStart, end: minute });
          currentStart = null;
        }
      }
      if (currentStart !== null) {
        result.push({ day, start: currentStart, end: 24 * 60 });
      }
    }
    return result;
  }, [counts, maxCount]);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      <div
        className="shrink-0 px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span
            className="text-[13px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            Common Availability
          </span>
        </div>
        <span
          className="text-[12px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {userIds.length} members total
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-w-0">
        {/* Legend */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Few
          </span>
          <div className="flex gap-0.5">
            {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-sm"
                style={{
                  background:
                    r === 0
                      ? "var(--card-bg)"
                      : r === 1
                        ? "var(--selected)"
                        : `color-mix(in srgb, var(--accent) ${Math.round(r * 55)}%, var(--card-bg))`,
                  border: "1px solid var(--border)",
                }}
              />
            ))}
          </div>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Many
          </span>
        </div>

        {/* Heatmap grid */}
        <div
          className="grid gap-px rounded-xl overflow-hidden select-none"
          style={{
            gridTemplateColumns: "32px repeat(7, minmax(0, 1fr))",
            gridTemplateRows: `28px repeat(${TOTAL_SLOTS}, minmax(0, 1fr))`,
            background: "var(--border)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{ background: "var(--card-bg)" }}
          />
          {DAYS.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-center text-xs font-semibold select-none"
              style={{ background: "var(--card-bg)", color: "var(--text)" }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: TOTAL_SLOTS }, (_, idx) => {
            const hour = Math.floor(idx / 2) + 8;
            const minOffset = (idx % 2) * 30;
            const minute = hour * 60 + minOffset;
            const showLabel = minOffset === 0;
            return (
              <div key={`row-${idx}`} className="contents">
                <div
                  className="flex items-center justify-end pr-1 text-[10px] font-mono select-none"
                  style={{
                    background: "var(--card-bg)",
                    color: showLabel ? "var(--text-muted)" : "transparent",
                  }}
                >
                  {showLabel ? fmt(minute) : ""}
                </div>
                {DAYS.map((_, day) => {
                  const count = counts[day][idx];
                  const people = peopleAt[day][idx];
                  return (
                    <div
                      key={`${day}-${minute}`}
                      className="transition-colors duration-75 select-none"
                      style={{ background: getColor(count), cursor: "pointer" }}
                      onMouseEnter={() =>
                        setHoverInfo({ day, minute, count, people })
                      }
                      onMouseLeave={() => setHoverInfo(null)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {hoverInfo && (
          <div
            className="mt-3 p-3 rounded-xl text-[12px]"
            style={{ background: "var(--card-inner-bg)" }}
          >
            <div
              className="font-semibold mb-1.5"
              style={{ color: "var(--text)" }}
            >
              {DAYS[hoverInfo.day]} {fmt(hoverInfo.minute)}~
              {fmt(hoverInfo.minute + 30)} — {hoverInfo.count}/{maxCount} available
            </div>
            <div className="flex flex-wrap gap-1">
              {hoverInfo.people.map((uid) => (
                <span
                  key={uid}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md"
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <img
                    src={memberMap[uid]?.avatar}
                    alt=""
                    className="w-3 h-3 rounded-full"
                  />
                  {memberMap[uid]?.name || uid}
                </span>
              ))}
            </div>
          </div>
        )}

        {intersections.length > 0 ? (
          <div className="mt-4">
            <div
              className="text-[12px] font-semibold mb-2"
              style={{ color: "var(--accent)" }}
            >
              Slots with 100% Availability
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {DAYS.map((d, i) => {
                const daySlots = intersections.filter((s) => s.day === i);
                return (
                  <div
                    key={i}
                    className="rounded-xl p-3 border"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div
                      className="text-xs font-semibold mb-1.5"
                      style={{ color: "var(--text)" }}
                    >
                      {d}
                    </div>
                    <div className="space-y-1">
                      {daySlots.length > 0 ? (
                        daySlots.map((s, idx) => (
                          <div
                            key={idx}
                            className="text-[11px] font-medium"
                            style={{ color: "var(--accent)" }}
                          >
                            {fmt(s.start)}~{fmt(s.end)}
                          </div>
                        ))
                      ) : (
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          None
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className="mt-4 p-4 rounded-xl text-[12px] text-center"
            style={{
              background: "var(--card-inner-bg)",
              color: "var(--text-secondary)",
            }}
          >
            No slots where all selected members are available
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MeetingsView
   ═══════════════════════════════════════ */
function MeetingsView() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setMeetings(data);
        setLoading(false);
      });
  }, []);

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.scheduledAt) >= now);
  const past = meetings.filter((m) => new Date(m.scheduledAt) < now);

  const formatRelative = (dateStr) => {
    const d = new Date(dateStr);
    const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return "Expired";
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff < 7) return `in ${diff} days`;
    if (diff < 30) return `in ${Math.floor(diff / 7)} weeks`;
    return `in ${Math.floor(diff / 30)} months`;
  };

  const formatGCalUrl = (m) => {
    if (!m || !m.scheduledAt) return "#";
    const start = new Date(m.scheduledAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const toGCalTime = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dates = `${toGCalTime(start)}/${toGCalTime(end)}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: m.title || "Meeting",
      dates,
      details: m.description || "",
      location: m.guildName || "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const MeetingCard = ({ meeting }) => (
    <div
      className="rounded-[var(--radius-xl)] border p-4 transition"
      style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="text-[15px] font-semibold truncate"
            style={{ color: "var(--text)" }}
          >
            {meeting.title}
          </div>
          {meeting.description && (
            <div
              className="text-[12px] mt-0.5 truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {meeting.description}
            </div>
          )}
        </div>
        <Badge
          variant={
            meeting.rsvpStatus === "going"
              ? "green"
              : meeting.rsvpStatus === "not_going"
                ? "red"
                : "info"
          }
        >
          {meeting.rsvpStatus === "going"
            ? "Attending"
            : meeting.rsvpStatus === "not_going"
              ? "Declined"
              : meeting.rsvpStatus === "maybe"
                ? "Maybe"
                : "Pending"}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {meeting.guildIcon ? (
          <img
            src={meeting.guildIcon}
            alt=""
            className="w-5 h-5 rounded-md shrink-0"
          />
        ) : (
          <div
            className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[8px] font-bold"
            style={{
              background: "var(--card-inner-bg)",
              color: "var(--accent)",
            }}
          >
            {meeting.guildName?.slice(0, 1)}
          </div>
        )}
        <span
          className="text-[12px] truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {meeting.guildName}
        </span>
        <span style={{ color: "var(--text-muted)" }}>·</span>
        <span
          className="text-[12px] font-medium"
          style={{ color: "var(--accent)" }}
        >
          {formatRelative(meeting.scheduledAt)}
        </span>
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {new Date(meeting.scheduledAt).toLocaleString("zh-TW", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--border)]">
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {meeting.isCreator && <span>Organizer</span>}
        </div>
        <a
          href={formatGCalUrl(meeting)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition shrink-0"
          style={{
            background: "var(--card-inner-bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text)";
          }}
        >
          <Calendar className="w-3.5 h-3.5" />
          Add to Google Calendar
        </a>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 min-w-0">
      <div className="min-w-0">
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          My Meetings
        </h2>
        <p
          className="text-[13px] mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          View meetings you are attending or organizing
        </p>
      </div>

      {loading ? (
        <div
          className="flex-1 flex items-center justify-center text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Loading...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6 min-w-0">
          {upcoming.length > 0 && (
            <div>
              <h3
                className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Upcoming
              </h3>
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3
                className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Past
              </h3>
              <div className="space-y-3 opacity-60">
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            </div>
          )}
          {meetings.length === 0 && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-20"
              style={{ color: "var(--text-muted)" }}
            >
              <Video className="w-10 h-10" />
              <p className="text-[13px]">No scheduled meetings found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   SettingsView
   ═══════════════════════════════════════ */
function SettingsView({ user, guilds }) {
  const [privacyMap, setPrivacyMap] = useState({});
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [emailInput, setEmailInput] = useState(user.email || "");
  const [savedEmail, setSavedEmail] = useState(user.email || "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  useEffect(() => {
    async function loadPrivacy() {
      const map = {};
      for (const g of guilds) {
        try {
          const res = await fetch(`/api/privacy/${g.id}`);
          if (res.ok) {
            const data = await res.json();
            map[g.id] = data.showSchedule;
          }
        } catch {}
      }
      setPrivacyMap(map);
    }
    if (guilds.length > 0) loadPrivacy();
  }, [guilds]);

  const togglePrivacy = async (guildId) => {
    const current = privacyMap[guildId] !== false;
    const next = !current;
    setPrivacyMap((prev) => ({ ...prev, [guildId]: next }));
    await fetch(`/api/privacy/${guildId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showSchedule: next }),
    });
  };

  const handleSaveEmail = async (e) => {
    e?.preventDefault();
    setEmailSaving(true);
    setEmailMsg(null);
    setTestMsg(null);
    try {
      const res = await fetch("/api/user/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailMsg({ type: "error", text: data.error || "Failed to save email." });
      } else {
        setSavedEmail(data.email || "");
        user.email = data.email || null;
        setEmailMsg({
          type: "success",
          text: data.email ? "Notification email saved successfully!" : "Notification email cleared.",
        });
      }
    } catch (err) {
      setEmailMsg({ type: "error", text: "Network connection error. Failed to save." });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestSending(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/user/email/test", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setTestMsg({ type: "error", text: data.error || "Failed to send test email." });
      } else {
        setTestMsg({
          type: "success",
          text: "Test email dispatched! Please check your inbox.",
        });
      }
    } catch (err) {
      setTestMsg({ type: "error", text: "Network connection error. Failed to send." });
    } finally {
      setTestSending(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "POST" });
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 min-w-0">
      <div className="min-w-0">
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Settings
        </h2>
        <p
          className="text-[13px] mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Manage your account and notification preferences
        </p>
      </div>

      <div className="max-w-xl space-y-4 min-w-0 overflow-y-auto">
        <div
          className="rounded-[var(--radius-xl)] border p-5"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Profile
          </h3>
          <div className="flex items-center gap-4">
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`}
              alt=""
              className="w-16 h-16 rounded-2xl"
              style={{ border: "1px solid var(--border)" }}
            />
            <div className="min-w-0">
              <div
                className="text-[15px] font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {user.name}
              </div>
              <div
                className="text-[13px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Discord ID: {user.id}
              </div>
            </div>
          </div>
        </div>

        {/* Notification EmailSettings */}
        <div
          className="rounded-[var(--radius-xl)] border p-5"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--text-muted)" }}
            >
              Notification Email
            </h3>
            <Badge variant={savedEmail ? "green" : "gray"}>
              {savedEmail ? "Configured" : "Not set"}
            </Badge>
          </div>
          <p
            className="text-[12px] mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            When meetings are scheduled or starting within 10 minutes, Chronocord will automatically dispatch email reminders to this address.
          </p>

          <form onSubmit={handleSaveEmail} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@example.com"
                className="flex-1 px-3.5 py-2.5 rounded-xl border text-[13px] outline-none transition"
                style={{
                  background: "var(--card-inner-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={emailSaving}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold transition flex items-center justify-center gap-1.5"
                  style={{
                    background: "var(--accent)",
                    color: "#ffffff",
                    opacity: emailSaving ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) =>
                    !emailSaving && (e.currentTarget.style.background = "var(--accent-hover)")
                  }
                  onMouseLeave={(e) =>
                    !emailSaving && (e.currentTarget.style.background = "var(--accent)")
                  }
                >
                  <Save className="w-4 h-4" />
                  {emailSaving ? "Saving..." : "Save Email"}
                </button>
                {savedEmail && (
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testSending}
                    className="px-3.5 py-2.5 rounded-xl text-[13px] font-medium border transition flex items-center justify-center gap-1.5"
                    style={{
                      background: "var(--card-inner-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                      opacity: testSending ? 0.5 : 1,
                    }}
                  >
                    <Mail className="w-4 h-4" />
                    {testSending ? "Sending..." : "Send Test Email"}
                  </button>
                )}
              </div>
            </div>

            {emailMsg && (
              <div
                className="text-[12px] flex items-center gap-1.5 mt-2"
                style={{
                  color:
                    emailMsg.type === "success"
                      ? "var(--tag-green-text)"
                      : "var(--tag-red-text)",
                }}
              >
                {emailMsg.type === "success" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {emailMsg.text}
              </div>
            )}

            {testMsg && (
              <div
                className="text-[12px] flex items-center gap-1.5 mt-1"
                style={{
                  color:
                    testMsg.type === "success"
                      ? "var(--tag-green-text)"
                      : "var(--tag-red-text)",
                }}
              >
                {testMsg.type === "success" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {testMsg.text}
              </div>
            )}
          </form>
        </div>

        {guilds.length > 0 && (
          <div
            className="rounded-[var(--radius-xl)] border p-5"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
          >
            <h3
              className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Privacy Settings
            </h3>
            <p
              className="text-[12px] mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Control whether other server members can inspect your availability schedule.
            </p>
            <div className="space-y-2">
              {guilds.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--card-inner-bg)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {g.icon ? (
                      <img
                        src={g.icon}
                        alt=""
                        className="w-6 h-6 rounded-md shrink-0"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: "var(--card-bg)",
                          color: "var(--accent)",
                        }}
                      >
                        {g.name.slice(0, 1)}
                      </div>
                    )}
                    <span
                      className="text-[13px] font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {g.name}
                    </span>
                  </div>
                  <button
                    onClick={() => togglePrivacy(g.id)}
                    className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition shrink-0"
                    style={{
                      background:
                        privacyMap[g.id] !== false
                          ? "var(--tag-green-bg)"
                          : "var(--tag-red-bg)",
                      color:
                        privacyMap[g.id] !== false
                          ? "var(--tag-green-text)"
                          : "var(--tag-red-text)",
                    }}
                  >
                    {privacyMap[g.id] !== false ? (
                      <>
                        <Eye className="w-3 h-3" /> Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" /> Hidden
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="rounded-[var(--radius-xl)] border p-5"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            About
          </h3>
          <div
            className="space-y-2 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <p>Regulus CalTime Bot</p>
            <p>Effortless team scheduling, availability resolving, and meeting coordination for Discord.</p>
          </div>
        </div>

        <div
          className="rounded-[var(--radius-xl)] border p-5"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Account
          </h3>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-xl transition"
            style={{
              background: "var(--tag-red-bg)",
              color: "var(--tag-red-text)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
