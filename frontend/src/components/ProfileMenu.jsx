import { useEffect, useRef, useState } from "react";

export default function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="profile-menu" ref={ref}>
      <button className="profile-trigger" onClick={() => setOpen((current) => !current)}>
        {initial}
      </button>
      {open ? (
        <div className="profile-dropdown">
          <p className="profile-name">{user?.name}</p>
          <p className="muted">{user?.email}</p>
          <button className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
