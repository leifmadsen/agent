import { Component, Input, OnChanges } from '@angular/core';
import { KeyAction, KeystrokeAction, KeystrokeType, SCANCODES, SECONDARY_ROLES } from 'uhk-common';

import { Tab } from '../tab';
import { MapperService } from '../../../../services/mapper.service';
import { SelectOptionData } from '../../../../models/select-option-data';

@Component({
    selector: 'keypress-tab',
    templateUrl: './keypress-tab.component.html',
    styleUrls: ['./keypress-tab.component.scss']
})
export class KeypressTabComponent extends Tab implements OnChanges {
    @Input() defaultKeyAction: KeyAction;
    @Input() secondaryRoleEnabled: boolean;

    leftModifiers: string[];
    rightModifiers: string[];

    leftModifierSelects: boolean[];
    rightModifierSelects: boolean[];

    scanCodeGroups: Array<SelectOptionData>;
    secondaryRoleGroups: Array<SelectOptionData>;

    selectedScancodeOption: SelectOptionData;
    selectedSecondaryRoleIndex: number;

    constructor(private mapper: MapperService) {
        super();
        this.leftModifiers = ['LShift', 'LCtrl', 'LSuper', 'LAlt'];
        this.rightModifiers = ['RShift', 'RCtrl', 'RSuper', 'RAlt'];
        this.scanCodeGroups = [{
            id: '0',
            text: 'None'
        }];
        this.scanCodeGroups = this.scanCodeGroups.concat(SCANCODES);
        this.secondaryRoleGroups = SECONDARY_ROLES;
        this.leftModifierSelects = Array(this.leftModifiers.length).fill(false);
        this.rightModifierSelects = Array(this.rightModifiers.length).fill(false);
        this.selectedScancodeOption = this.scanCodeGroups[0];
        this.selectedSecondaryRoleIndex = -1;
    }

    ngOnChanges() {
        this.fromKeyAction(this.defaultKeyAction);
        this.validAction.emit(this.keyActionValid());
    }

    keyActionValid(keystrokeAction?: KeystrokeAction): boolean {
        if (!keystrokeAction) {
            keystrokeAction = this.toKeyAction();
        }

        return (keystrokeAction) ? (keystrokeAction.scancode > 0 || keystrokeAction.modifierMask > 0) : false;
    }

    onKeysCapture(event: { code: number, left: boolean[], right: boolean[] }) {
        if (event.code) {
            this.selectedScancodeOption = this.findScancodeOptionByScancode(event.code, KeystrokeType.basic);
        } else {
            this.selectedScancodeOption = this.scanCodeGroups[0];
        }

        this.leftModifierSelects = event.left;
        this.rightModifierSelects = event.right;
        this.validAction.emit(this.keyActionValid());
    }

    fromKeyAction(keyAction: KeyAction): boolean {
        if (!(keyAction instanceof KeystrokeAction)) {
            return false;
        }
        const keystrokeAction: KeystrokeAction = <KeystrokeAction>keyAction;
        // Restore selectedScancodeOption
        this.selectedScancodeOption = this.findScancodeOptionByScancode(keystrokeAction.scancode || 0, keystrokeAction.type);

        const leftModifiersLength: number = this.leftModifiers.length;

        // Restore modifiers
        for (let i = 0; i < leftModifiersLength; ++i) {
            this.leftModifierSelects[this.mapper.modifierMapper(i)] = ((keystrokeAction.modifierMask >> i) & 1) === 1;
        }

        for (let i = leftModifiersLength; i < leftModifiersLength + this.rightModifierSelects.length; ++i) {
            const index: number = this.mapper.modifierMapper(i) - leftModifiersLength;
            this.rightModifierSelects[index] = ((keystrokeAction.modifierMask >> i) & 1) === 1;
        }

        // Restore secondaryRoleAction
        if (keystrokeAction.secondaryRoleAction !== undefined) {
            this.selectedSecondaryRoleIndex = this.mapper.modifierMapper(keystrokeAction.secondaryRoleAction);
        } else {
            this.selectedSecondaryRoleIndex = -1;
        }

        return true;
    }

    toKeyAction(): KeystrokeAction {
        const keystrokeAction: KeystrokeAction = new KeystrokeAction();
        const scTypePair = this.toScancodeTypePair(this.selectedScancodeOption);
        keystrokeAction.scancode = scTypePair[0];
        if (scTypePair[1] === 'media') {
            keystrokeAction.type = keystrokeAction.scancode > 255 ? KeystrokeType.longMedia : KeystrokeType.shortMedia;
        } else {
            keystrokeAction.type = KeystrokeType[scTypePair[1]];
        }
        keystrokeAction.modifierMask = 0;
        const modifiers = this.leftModifierSelects.concat(this.rightModifierSelects).map(x => x ? 1 : 0);
        for (let i = 0; i < modifiers.length; ++i) {
            keystrokeAction.modifierMask |= modifiers[i] << this.mapper.modifierMapper(i);
        }

        keystrokeAction.secondaryRoleAction = this.selectedSecondaryRoleIndex === -1
            ? undefined
            : this.mapper.modifierMapper(this.selectedSecondaryRoleIndex);

        if (this.keyActionValid(keystrokeAction)) {
            return keystrokeAction;
        }
    }

    toggleModifier(right: boolean, index: number) {
        const modifierSelects: boolean[] = right ? this.rightModifierSelects : this.leftModifierSelects;
        modifierSelects[index] = !modifierSelects[index];

        this.validAction.emit(this.keyActionValid());
    }

    onSecondaryRoleChange(id: string) {
        this.selectedSecondaryRoleIndex = +id;
    }

    onScancodeChange(id: string) {
        this.selectedScancodeOption = this.findScancodeOptionById(id);

        this.validAction.emit(this.keyActionValid());
    }

    private findScancodeOptionBy(predicate: (option: SelectOptionData) => boolean): SelectOptionData {
        let selectedOption: SelectOptionData;

        const scanCodeGroups: SelectOptionData[] = [...this.scanCodeGroups];
        while (scanCodeGroups.length > 0) {
            const scanCodeGroup = scanCodeGroups.shift();
            if (predicate(scanCodeGroup)) {
                selectedOption = scanCodeGroup;
                break;
            }

            if (scanCodeGroup.children) {
                scanCodeGroups.push(...scanCodeGroup.children);
            }
        }
        return selectedOption;
    }

    private findScancodeOptionById(id: string): SelectOptionData {
        return this.findScancodeOptionBy(option => option.id === id);
    }

    private findScancodeOptionByScancode(scancode: number, type: KeystrokeType): SelectOptionData {
        const typeToFind: string =
            (type === KeystrokeType.shortMedia || type === KeystrokeType.longMedia) ? 'media' : KeystrokeType[type];
        return this.findScancodeOptionBy((option: SelectOptionData) => {
            const additional = option.additional;
            if (additional && additional.scancode === scancode && additional.type === typeToFind) {
                return true;
            } else if ((!additional || additional.scancode === undefined) && +option.id === scancode) {
                return true;
            } else {
                return false;
            }
        });
    }

    private toScancodeTypePair(option: SelectOptionData): [number, string] {
        let scanCode: number;
        let type: string;
        if (option.additional) {
            scanCode = option.additional.scancode;
            type = option.additional.type || 'basic';
        } else {
            type = 'basic';
        }
        if (scanCode === undefined) {
            scanCode = +option.id;
        }

        return [scanCode, type];
    }

}
