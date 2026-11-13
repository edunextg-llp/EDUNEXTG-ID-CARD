import { useMemo } from "react";
import { getAllStates, getDistricts } from "india-state-district";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface IndiaStateDistrictSelectProps {
  stateValue: string;
  districtValue: string;
  onStateChange: (stateName: string) => void;
  onDistrictChange: (districtName: string) => void;
  stateLabel?: string;
  districtLabel?: string;
  disabled?: boolean;
}

const NONE_VALUE = "__none__";

export function IndiaStateDistrictSelect({
  stateValue,
  districtValue,
  onStateChange,
  onDistrictChange,
  stateLabel = "State",
  districtLabel = "District",
  disabled = false,
}: IndiaStateDistrictSelectProps) {
  // Sorted list of states from india-state-district
  const states = useMemo(() => {
    try {
      const all = getAllStates() || [];
      return [...all].sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }, []);

  // Find currently matched state object by code or name
  const currentStateObj = useMemo(() => {
    if (!stateValue) return null;
    const trimmed = stateValue.trim().toLowerCase();
    return (
      states.find(
        (s) =>
          s.name.toLowerCase() === trimmed || s.code.toLowerCase() === trimmed
      ) || null
    );
  }, [stateValue, states]);

  // Districts for current state
  const districts = useMemo(() => {
    if (!currentStateObj) return [];
    try {
      const list = getDistricts(currentStateObj.code) || [];
      return [...list].sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }, [currentStateObj]);

  const handleStateSelect = (val: string) => {
    if (val === NONE_VALUE) {
      onStateChange("");
      onDistrictChange("");
      return;
    }
    const found = states.find((s) => s.code === val);
    const newStateName = found ? found.name : val;
    onStateChange(newStateName);

    // If district doesn't belong to new state, reset it
    if (found) {
      try {
        const newDistricts = getDistricts(found.code) || [];
        const currentTrimmed = districtValue.trim().toLowerCase();
        const exists = newDistricts.some(
          (d) => d.trim().toLowerCase() === currentTrimmed
        );
        if (!exists) {
          onDistrictChange("");
        }
      } catch {
        onDistrictChange("");
      }
    } else {
      onDistrictChange("");
    }
  };

  const handleDistrictSelect = (val: string) => {
    onDistrictChange(val === NONE_VALUE ? "" : val);
  };

  // Resolve values for Radix Select (Radix requires non-empty string)
  const currentSelectStateVal = currentStateObj
    ? currentStateObj.code
    : stateValue
    ? `custom:${stateValue}`
    : NONE_VALUE;

  const currentSelectDistrictVal = districtValue ? districtValue : NONE_VALUE;

  return (
    <>
      {/* State Dropdown */}
      <div>
        <label className="text-xs font-bold text-foreground">
          {stateLabel}
        </label>
        <Select
          value={currentSelectStateVal}
          onValueChange={handleStateSelect}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1 w-full h-10 rounded-xl text-xs bg-background border-border">
            <SelectValue placeholder="Select State" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value={NONE_VALUE}>-- Select State --</SelectItem>
            {/* If stateValue is legacy custom not in list, render it */}
            {stateValue && !currentStateObj && (
              <SelectItem value={`custom:${stateValue}`}>
                {stateValue}
              </SelectItem>
            )}
            {states.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District Dropdown */}
      <div>
        <label className="text-xs font-bold text-foreground">
          {districtLabel}
        </label>
        <Select
          value={currentSelectDistrictVal}
          onValueChange={handleDistrictSelect}
          disabled={disabled || !currentStateObj || districts.length === 0}
        >
          <SelectTrigger className="mt-1 w-full h-10 rounded-xl text-xs bg-background border-border">
            <SelectValue
              placeholder={
                !currentStateObj ? "Select State first" : "Select District"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value={NONE_VALUE}>
              {!currentStateObj
                ? "-- Select State first --"
                : "-- Select District --"}
            </SelectItem>
            {/* If districtValue is legacy custom not in list, render it */}
            {districtValue &&
              !districts.some(
                (d) => d.toLowerCase() === districtValue.trim().toLowerCase()
              ) && (
                <SelectItem value={districtValue}>{districtValue}</SelectItem>
              )}
            {districts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
