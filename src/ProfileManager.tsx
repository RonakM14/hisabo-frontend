import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  House,
  Wallet,
  LoaderCircle,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import { api } from "./api";
import type { Profile } from "./types";
import type { ProfileTemplate } from "./mortgage";

export function profileInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toLocaleUpperCase();
}

export default function ProfileManager({
  profiles,
  activeId,
  busy,
  setBusy,
  onSelect,
  onSaved,
}: {
  profiles: Profile[];
  activeId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onSelect: (profile: Profile) => void;
  onSaved: (profile: Profile, created: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<ProfileTemplate>("BUDGET");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = editing
        ? await api.renameProfile(editing.id, name)
        : await api.createProfile(name, template);
      onSaved(saved, !editing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-manager">
      <div className="profile-explainer">
        <span>
          <Users size={21} />
        </span>
        <div>
          <strong>A space for every budget</strong>
          <p>
            Create as many profiles as you need. Transactions, budgets, and
            charts stay separate.
          </p>
        </div>
      </div>
      <div className="profile-list" aria-label="Your profiles">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`profile-row ${profile.id === activeId ? "selected" : ""}`}
          >
            <button
              className="profile-choice"
              disabled={busy}
              onClick={() => onSelect(profile)}
              aria-label={`Switch to ${profile.name}`}
            >
              <span className="profile-avatar">
                {profileInitials(profile.name)}
              </span>
              <span className="profile-row-copy">
                <strong>{profile.name}</strong>
                <small>
                  {profile.id === activeId
                    ? "Current profile"
                    : profile.template === "MORTGAGE"
                      ? "Mortgage planner"
                      : "Open this profile"}
                </small>
              </span>
              {profile.id === activeId ? (
                <Check size={18} />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`Rename ${profile.name}`}
              onClick={() => {
                setEditing(profile);
                setName(profile.name);
                setError("");
              }}
            >
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
      <form className="profile-create" onSubmit={(event) => void save(event)}>
        <div className="profile-form-heading">
          <h3>{editing ? `Rename ${editing.name}` : "Add a new profile"}</h3>
          {editing && (
            <button
              type="button"
              className="icon-button"
              aria-label="Cancel rename"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setName("");
                setError("");
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {!editing && (
          <fieldset className="template-picker">
            <legend>
              Choose a starting point <span>Optional</span>
            </legend>
            <label className={template === "BUDGET" ? "selected" : ""}>
              <input
                type="radio"
                name="profile-template"
                value="BUDGET"
                checked={template === "BUDGET"}
                onChange={() => setTemplate("BUDGET")}
                disabled={busy}
              />
              <Wallet size={23} />
              <strong>Blank budget</strong>
              <small>Income, expenses, and monthly budgets.</small>
            </label>
            <label className={template === "MORTGAGE" ? "selected" : ""}>
              <input
                type="radio"
                name="profile-template"
                value="MORTGAGE"
                checked={template === "MORTGAGE"}
                onChange={() => setTemplate("MORTGAGE")}
                disabled={busy}
              />
              <House size={23} />
              <strong>Home & mortgage</strong>
              <small>Payoff planning, extra payments, and improvements.</small>
            </label>
          </fieldset>
        )}
        <label htmlFor="profile-name">Profile name</label>
        <div className="profile-input-row">
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            placeholder="e.g. Ronak, Family, or Travel"
            autoComplete="off"
            disabled={busy}
          />
          <button className="primary-button" disabled={busy || !name.trim()}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : editing ? (
              <Check size={17} />
            ) : (
              <Plus size={17} />
            )}
            {editing ? "Save name" : "Create profile"}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="profile-excel-note">
        <FileSpreadsheet size={19} />
        <p>
          Each profile gets a yearly Excel workbook named after it, with 12
          monthly tabs. Mortgage profiles also get a dedicated payoff workbook.
          Hisabo updates them when you save. Make changes here in the app; Excel
          is a downloadable copy.
        </p>
      </div>
    </div>
  );
}
