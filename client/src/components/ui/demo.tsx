import React from 'react';
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";

export default function DemoOne() {
  const [open, setOpen] = React.useState(false);

	return (
		<button onClick={() => setOpen(!open)}>
			<MenuToggleIcon open={open} className="size-20" duration={500} />
		</button>
	);
}
