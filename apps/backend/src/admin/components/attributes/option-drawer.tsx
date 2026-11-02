import { Button, Drawer, Input, Label, Switch, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { attributesApi, OptionBody } from "../../lib/attributes-api"
import { describeError } from "../../lib/error-code"
import { suggestHandle } from "../../lib/handle"
import { AttributeOption, emptyL10n, fromL10nForm, L10nForm, toL10nForm } from "../../lib/types"
import { L10nInput } from "../l10n-input"

const DEFAULT_SWATCH = "#888888"

type OptionDrawerProps = {
  attributeId: string
  /** The option to edit, or null to add one. */
  option: AttributeOption | null
  /** Offered as the rank of a new option. */
  nextRank: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Adds or edits one option: handle, label, swatch and rank. */
export const OptionDrawer = ({
  attributeId,
  option,
  nextRank,
  open,
  onOpenChange,
}: OptionDrawerProps) => {
  const queryClient = useQueryClient()
  const [handle, setHandle] = useState(option?.handle ?? "")
  const [handleEdited, setHandleEdited] = useState(!!option)
  const [label, setLabel] = useState<L10nForm>(option ? toL10nForm(option.label) : emptyL10n())
  const [useSwatch, setUseSwatch] = useState(!!option?.swatch_hex)
  const [swatch, setSwatch] = useState(option?.swatch_hex ?? DEFAULT_SWATCH)
  const [rank, setRank] = useState(String(option?.rank ?? nextRank))

  const save = useMutation({
    mutationFn: () => {
      const body: OptionBody = {
        handle,
        label: fromL10nForm(label),
        rank: Number.parseInt(rank, 10) || 0,
        swatch_hex: useSwatch ? swatch.toLowerCase() : null,
      }
      return option
        ? attributesApi.updateOption(attributeId, option.id, body)
        : attributesApi.createOption(attributeId, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] })
      toast.success(option ? "Option saved" : "Option added")
      onOpenChange(false)
    },
    onError: (error) => toast.error(describeError(error)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form onSubmit={submit} className="flex h-full flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>{option ? "Edit option" : "Add option"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
            <L10nInput
              label="Label"
              value={label}
              maxLength={100}
              onChange={(next) => {
                setLabel(next)
                if (!handleEdited) {
                  setHandle(suggestHandle(next.en, "option"))
                }
              }}
            />
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="option-handle" size="small" weight="plus">
                Handle *
              </Label>
              <Input
                id="option-handle"
                value={handle}
                maxLength={40}
                onChange={(event) => {
                  setHandle(event.target.value)
                  setHandleEdited(true)
                }}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Lower case letters, digits and underscores. Search filters use it (for example
                fabric:cotton), so change it with care.
              </Text>
            </div>
            <div className="flex flex-col gap-y-2">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Colour swatch
                </Label>
                <Switch checked={useSwatch} onCheckedChange={setUseSwatch} />
              </div>
              {useSwatch && (
                <div className="flex items-center gap-x-3">
                  <input
                    type="color"
                    aria-label="Swatch colour"
                    value={swatch}
                    className="h-8 w-12 cursor-pointer rounded border border-ui-border-base"
                    onChange={(event) => setSwatch(event.target.value)}
                  />
                  <code>{swatch.toLowerCase()}</code>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="option-rank" size="small" weight="plus">
                Rank
              </Label>
              <Input
                id="option-rank"
                type="number"
                min={0}
                value={rank}
                onChange={(event) => setRank(event.target.value)}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Lower ranks are listed first.
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </Drawer.Close>
            <Button
              type="submit"
              isLoading={save.isPending}
              disabled={!label.en.trim() || !handle.trim()}
            >
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
