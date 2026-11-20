import { ActionIcon, Menu } from "@mantine/core";
import { IconDots, IconEye, IconEyeOff } from "@tabler/icons-react";

interface FormationMenuProps {
  /** The formation's name ("2nd Brigade"). */
  name: string;
  /** It's the formation picked out on the map now. */
  pickedOut: boolean;
  /** Picks it out on the map, or, while it's picked out, shows every unit again. */
  onPickOut: () => void;
}

/**
 * What can be done with a formation from its heading beside the map (step 64): pick it out on the
 * map, fading the rest, or show every unit again.
 */
export function FormationMenu({ name, pickedOut, onPickOut }: FormationMenuProps) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`${name}: actions`}>
          <IconDots size={16} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={
            pickedOut ? <IconEyeOff size={16} aria-hidden /> : <IconEye size={16} aria-hidden />
          }
          onClick={onPickOut}
        >
          {pickedOut ? "Show every unit" : "Pick out on the map"}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
