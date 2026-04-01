import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpTrayIcon, PhotoIcon } from '@heroicons/react/24/outline';
import fieldService from '../services/fieldService';
import teamService from '../services/teamService';
import { DEFAULT_JERSEY_COLOR, getNextJerseyColor, normalizeHexColor, normalizeJerseyColors } from '../utils/teamColors';
import { compressImageForUpload } from '../utils/imageCompression';
import JerseyColorEditor from '../components/teams/JerseyColorEditor';

const MAX_TEAM_LOGO_SIZE_MB = 5;
const MAX_TEAM_LOGO_SIZE_BYTES = MAX_TEAM_LOGO_SIZE_MB * 1024 * 1024;

const TeamCreatePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/owner') ? '/owner' : '/app';

  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    skillLevel: 'intermediate',
    maxPlayers: 11,
    homeFieldId: '',
    jerseyColors: [DEFAULT_JERSEY_COLOR]
  });
  const trimmedTeamName = formData.name.trim();
  const normalizedMaxPlayers = Number(formData.maxPlayers) || 0;
  const isNameValid = trimmedTeamName.length >= 2 && trimmedTeamName.length <= 100;
  const isMaxPlayersValid = normalizedMaxPlayers >= 5 && normalizedMaxPlayers <= 30;
  const canSubmit = !submitting && isNameValid && isMaxPlayersValid;

  useEffect(() => {
    const fetchFields = async () => {
      try {
        setLoading(true);
        const response = await fieldService.getAllFields({ status: 'available', limit: 100 });
        const fieldsData = Array.isArray(response.data) ? response.data : [];
        setFields(fieldsData);
      } catch (err) {
        console.error('Failed to load fields:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  useEffect(() => {
    setActiveColorIndex((prev) => {
      const colors = Array.isArray(formData.jerseyColors) ? formData.jerseyColors : [DEFAULT_JERSEY_COLOR];
      return Math.min(prev, colors.length - 1);
    });
  }, [formData.jerseyColors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'maxPlayers' ? Number(value) : value
    }));
  };

  const setJerseyColorAt = (index, value) => {
    const normalized = normalizeHexColor(value) || DEFAULT_JERSEY_COLOR;
    setFormData((prev) => {
      const next = Array.isArray(prev.jerseyColors) ? [...prev.jerseyColors] : [DEFAULT_JERSEY_COLOR];
      next[index] = normalized;
      return { ...prev, jerseyColors: next };
    });
  };

  const handleAddJerseyColor = () => {
    setFormData((prev) => {
      const current = Array.isArray(prev.jerseyColors) ? [...prev.jerseyColors] : [DEFAULT_JERSEY_COLOR];
      if (current.length >= 5) return prev;
      return { ...prev, jerseyColors: [...current, getNextJerseyColor(current)] };
    });
  };

  const handleRemoveJerseyColor = (index) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.jerseyColors) ? [...prev.jerseyColors] : [DEFAULT_JERSEY_COLOR];
      if (current.length <= 1) return prev;
      current.splice(index, 1);
      return { ...prev, jerseyColors: current };
    });
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for the team picture.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_TEAM_LOGO_SIZE_BYTES) {
      setError(`Team picture must be smaller than ${MAX_TEAM_LOGO_SIZE_MB}MB.`);
      e.target.value = '';
      return;
    }

    const compressedFile = await compressImageForUpload(file, {
      maxWidth: 900,
      maxHeight: 900,
      targetMaxBytes: 450 * 1024,
      minCompressBytes: 150 * 1024
    });

    setError(null);
    setSelectedLogoFile(compressedFile);
    setLogoPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(compressedFile);
    });
  };

  const handleRemoveLogo = () => {
    setSelectedLogoFile(null);
    setLogoPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!isNameValid) {
        setError('Team name must be between 2 and 100 characters.');
        return;
      }

      if (!isMaxPlayersValid) {
        setError('Max players must be between 5 and 30.');
        return;
      }

      const normalizedColors = normalizeJerseyColors(formData.jerseyColors);
      if (normalizedColors.length < 1) {
        setError('Please choose at least 1 jersey color.');
        return;
      }

      const payload = {
        name: trimmedTeamName,
        description: formData.description || undefined,
        skillLevel: formData.skillLevel,
        maxPlayers: normalizedMaxPlayers,
        homeFieldId: formData.homeFieldId ? Number(formData.homeFieldId) : undefined,
        jerseyColors: normalizedColors
      };

      if (!payload.name || !payload.name.trim()) {
        setError('Team name is required.');
        setSubmitting(false);
        return;
      }

      if (!Number.isFinite(payload.maxPlayers) || payload.maxPlayers < 1) {
        setError('Max players must be a valid number.');
        setSubmitting(false);
        return;
      }

      const response = await teamService.createTeam(payload);
      if (response.success) {
        let createdTeamId = response.data?.id || response.data?.team?.id || response.data?.data?.id || null;

        if (!createdTeamId) {
          try {
            const captainedTeamsResponse = await teamService.getCaptainedTeams();
            const captainedTeams = Array.isArray(captainedTeamsResponse.data) ? captainedTeamsResponse.data : [];
            const matchingTeam = captainedTeams.find((team) => team?.name === payload.name);
            createdTeamId = matchingTeam?.id || captainedTeams[0]?.id || null;
          } catch {
            createdTeamId = null;
          }
        }

        let navigationState = { successMessage: 'Team created successfully!' };

        if (createdTeamId && selectedLogoFile) {
          try {
            const uploadFormData = new FormData();
            uploadFormData.append('logo', selectedLogoFile);
            await teamService.uploadTeamLogo(createdTeamId, uploadFormData);
            navigationState = { successMessage: 'Team created successfully with team picture!' };
          } catch (uploadErr) {
            navigationState = {
              errorMessage: uploadErr?.error || 'Team created, but the team picture upload failed.'
            };
          }
        }

        navigate(createdTeamId ? `${basePath}/teams/${createdTeamId}` : `${basePath}/teams`, {
          replace: true,
          state: navigationState
        });
      }
    } catch (err) {
      const validationError =
        Array.isArray(err?.data?.errors) && err.data.errors.length > 0
          ? err.data.errors[0]?.message
          : null;
      setError(validationError || err?.error || err?.message || 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Team</h1>
        <p className="mt-1 text-sm text-gray-600">Create your squad, choose jersey colors, and get ready to manage players as captain.</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 px-4 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Captain Setup</h2>
          <p className="mt-2 text-sm text-slate-700">
            Start with your team identity first, then pick an optional home field and jersey colors before creating the squad.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Team Name</label>
          <input
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="Downtown FC"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className={isNameValid || trimmedTeamName.length === 0 ? 'text-gray-500' : 'text-red-600'}>
              Use 2 to 100 characters.
            </span>
            <span className="text-gray-400">{trimmedTeamName.length}/100</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Team Picture</label>
            <span className="text-xs text-gray-500">Optional, up to {MAX_TEAM_LOGO_SIZE_MB}MB</span>
          </div>
          <div className="mt-2 flex items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="h-24 w-24 overflow-hidden rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Team logo preview" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center">
                  <PhotoIcon className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-1 text-[11px] text-gray-500">No picture</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <ArrowUpTrayIcon className="h-4 w-4" />
                Upload Picture
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              <p className="text-xs text-gray-500">PNG, JPG, GIF, or WEBP. Best result: square image.</p>
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Remove picture
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Skill Level</label>
            <select
              name="skillLevel"
              value={formData.skillLevel}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="professional">Professional</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Max Players</label>
            <input
              type="number"
              name="maxPlayers"
              min={1}
              max={50}
              value={formData.maxPlayers}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            />
            <p className={`mt-1 text-xs ${isMaxPlayersValid ? 'text-gray-500' : 'text-red-600'}`}>
              Choose a squad size between 5 and 30 players.
            </p>
          </div>
        </div>

        <div>
          <JerseyColorEditor
            title="Team Jersey Colors"
            description="Choose one or more colors for your team kit before you create the team."
            helperText="Click any color card to open the picker. The preview updates while you drag."
            colors={formData.jerseyColors || [DEFAULT_JERSEY_COLOR]}
            currentColors={formData.jerseyColors || [DEFAULT_JERSEY_COLOR]}
            activeColorIndex={activeColorIndex}
            onActiveColorChange={setActiveColorIndex}
            onColorChange={setJerseyColorAt}
            onAddColor={handleAddJerseyColor}
            onRemoveColor={handleRemoveJerseyColor}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Home Field (Optional)</label>
          <select
            name="homeFieldId"
            value={formData.homeFieldId}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
          >
            <option value="">No home field</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name} ({field.city})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {fields.length > 0
              ? `${fields.length} available field${fields.length === 1 ? '' : 's'} loaded for captain selection.`
              : 'No available fields found right now. You can still create a team without one.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="About your team..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            to={`${basePath}/teams`}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
      <aside className="xl:sticky xl:top-6 xl:self-start space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Team Preview</h2>
          <p className="mt-1 text-sm text-slate-500">A quick view of how your new team setup looks before you create it.</p>

          <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                {logoPreview ? (
                  <img src={logoPreview} alt="Team logo preview" className="h-full w-full object-cover" />
                ) : (
                  <PhotoIcon className="h-7 w-7 text-white/70" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{trimmedTeamName || 'Your Team Name'}</div>
                <div className="text-sm text-white/70">{formData.skillLevel.charAt(0).toUpperCase() + formData.skillLevel.slice(1)} squad</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/10 px-3 py-3">
                <div className="text-white/60">Max Players</div>
                <div className="mt-1 text-xl font-semibold">{normalizedMaxPlayers || 11}</div>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-3">
                <div className="text-white/60">Home Field</div>
                <div className="mt-1 truncate font-semibold">
                  {fields.find((field) => String(field.id) === String(formData.homeFieldId))?.name || 'Not selected'}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm text-white/60">Jersey Colors</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(formData.jerseyColors || [DEFAULT_JERSEY_COLOR]).map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className="h-9 w-9 rounded-full border-2 border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.3)]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Captain Tips</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>Pick a clear team name that your players can recognize quickly.</p>
            <p>Use jersey colors that are easy to distinguish during matches.</p>
            <p>Choose a home field now if your team usually plays in one location.</p>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
};

export default TeamCreatePage;
