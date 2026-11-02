import { ArrowLeft, PencilSquare, Plus, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Prompt,
  Select,
  Switch,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { CategoryLinks } from "../../../../components/attributes/category-links"
import { OptionDrawer } from "../../../../components/attributes/option-drawer"
import { L10nInput } from "../../../../components/l10n-input"
import { attributesApi } from "../../../../lib/attributes-api"
import { describeError } from "../../../../lib/error-code"
import {
  ATTRIBUTE_TYPES,
  ATTRIBUTE_UNITS,
  Attribute,
  AttributeOption,
  fromL10nForm,
  L10nForm,
  toL10nForm,
} from "../../../../lib/types"

const NO_UNIT = "__none__"

const typeLabel = (type: string) =>
  ATTRIBUTE_TYPES.find((entry) => entry.value === type)?.label ?? type

const GeneralSection = ({ attribute }: { attribute: Attribute }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState<L10nForm>(toL10nForm(attribute.label))
  const [unit, setUnit] = useState(attribute.unit ?? NO_UNIT)
  const [group, setGroup] = useState(attribute.group_handle ?? "")
  const [filterable, setFilterable] = useState(attribute.filterable)
  const [required, setRequired] = useState(attribute.required)
  const [rank, setRank] = useState(String(attribute.rank))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: () =>
      attributesApi.update(attribute.id, {
        label: fromL10nForm(label),
        unit: attribute.type === "number" ? (unit === NO_UNIT ? null : unit) : undefined,
        group_handle: group.trim() || null,
        filterable,
        required,
        rank: Number.parseInt(rank, 10) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] })
      toast.success("Attribute saved")
    },
    onError: (error) => toast.error(describeError(error)),
  })

  const remove = useMutation({
    mutationFn: () => attributesApi.remove(attribute.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] })
      toast.success("Attribute deleted")
      navigate("/settings/attributes")
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error(describeError(error))
    },
  })

  return (
    <div className="flex flex-col gap-y-5 px-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <Heading level="h2">Details</Heading>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge size="2xsmall">
              <code>{attribute.handle}</code>
            </Badge>
            <Badge size="2xsmall">{typeLabel(attribute.type)}</Badge>
            <Text size="small" className="text-ui-fg-subtle">
              The handle and the type can&apos;t be changed.
            </Text>
          </div>
        </div>
        <Button size="small" variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash />
          Delete
        </Button>
      </div>

      <L10nInput label="Label" value={label} maxLength={100} onChange={setLabel} />

      <div className="grid grid-cols-2 gap-4">
        {attribute.type === "number" && (
          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus">
              Unit
            </Label>
            <Select value={unit} onValueChange={setUnit}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NO_UNIT}>No unit</Select.Item>
                {ATTRIBUTE_UNITS.map((entry) => (
                  <Select.Item key={entry} value={entry}>
                    {entry}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="attribute-group" size="small" weight="plus">
            Group
          </Label>
          <Input
            id="attribute-group"
            value={group}
            maxLength={100}
            placeholder="style, size, care, specs"
            onChange={(event) => setGroup(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="attribute-rank" size="small" weight="plus">
            Rank
          </Label>
          <Input
            id="attribute-rank"
            type="number"
            min={0}
            value={rank}
            onChange={(event) => setRank(event.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-x-10">
        <div className="flex items-center gap-x-3">
          <Switch id="attribute-filterable" checked={filterable} onCheckedChange={setFilterable} />
          <Label htmlFor="attribute-filterable" size="small">
            Filterable by shoppers
          </Label>
        </div>
        <div className="flex items-center gap-x-3">
          <Switch id="attribute-required" checked={required} onCheckedChange={setRequired} />
          <Label htmlFor="attribute-required" size="small">
            Required
          </Label>
        </div>
      </div>

      <div>
        <Button
          size="small"
          isLoading={save.isPending}
          disabled={!label.en.trim()}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </div>

      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Delete this attribute?</Prompt.Title>
            <Prompt.Description>
              {attribute.value_count
                ? `${attribute.value_count} product(s) still have a value for it, so it can't be deleted until they are cleared.`
                : "Its options and category links are deleted with it."}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancel</Prompt.Cancel>
            <Prompt.Action onClick={() => remove.mutate()}>Delete</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}

const OptionsSection = ({ attribute }: { attribute: Attribute }) => {
  const queryClient = useQueryClient()
  const [drawer, setDrawer] = useState<{ option: AttributeOption | null } | null>(null)
  const [toDelete, setToDelete] = useState<AttributeOption | null>(null)

  const remove = useMutation({
    mutationFn: (option: AttributeOption) => attributesApi.removeOption(attribute.id, option.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] })
      toast.success("Option deleted")
      setToDelete(null)
    },
    onError: (error) => {
      setToDelete(null)
      toast.error(describeError(error))
    },
  })

  const nextRank = attribute.options.reduce((max, option) => Math.max(max, option.rank + 1), 0)

  return (
    <div className="flex flex-col gap-y-3 py-4">
      <div className="flex items-center justify-between px-6">
        <div>
          <Heading level="h2">Options</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            The choices staff pick from and shoppers filter by.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setDrawer({ option: null })}>
          <Plus />
          Add option
        </Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Rank</Table.HeaderCell>
            <Table.HeaderCell>Swatch</Table.HeaderCell>
            <Table.HeaderCell>Handle</Table.HeaderCell>
            <Table.HeaderCell>Label</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {attribute.options.map((option) => (
            <Table.Row key={option.id}>
              <Table.Cell>{option.rank}</Table.Cell>
              <Table.Cell>
                {option.swatch_hex ? (
                  <span
                    title={option.swatch_hex}
                    className="inline-block h-5 w-5 rounded-full border border-ui-border-base"
                    style={{ backgroundColor: option.swatch_hex }}
                  />
                ) : (
                  "-"
                )}
              </Table.Cell>
              <Table.Cell>
                <code>{option.handle}</code>
              </Table.Cell>
              <Table.Cell>{option.label.en}</Table.Cell>
              <Table.Cell>
                <div className="flex justify-end gap-x-1">
                  <IconButton
                    size="small"
                    variant="transparent"
                    aria-label={`Edit ${option.label.en}`}
                    onClick={() => setDrawer({ option })}
                  >
                    <PencilSquare />
                  </IconButton>
                  <IconButton
                    size="small"
                    variant="transparent"
                    aria-label={`Delete ${option.label.en}`}
                    onClick={() => setToDelete(option)}
                  >
                    <Trash />
                  </IconButton>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
          {!attribute.options.length && (
            <Table.Row>
              <Table.Cell>No options yet.</Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>

      {drawer && (
        <OptionDrawer
          key={drawer.option?.id ?? "new"}
          attributeId={attribute.id}
          option={drawer.option}
          nextRank={nextRank}
          open
          onOpenChange={(open) => !open && setDrawer(null)}
        />
      )}

      <Prompt open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Delete option {toDelete?.label.en}?</Prompt.Title>
            <Prompt.Description>
              A product that uses it blocks the delete until it is changed.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancel</Prompt.Cancel>
            <Prompt.Action onClick={() => toDelete && remove.mutate(toDelete)}>Delete</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}

const AttributeDetail = ({ attribute }: { attribute: Attribute }) => {
  const hasOptions = attribute.type === "select" || attribute.type === "multiselect"
  return (
    <div className="flex flex-col gap-y-3">
      <Link
        to="/settings/attributes"
        className="txt-compact-small-plus flex items-center gap-x-1 text-ui-fg-subtle hover:text-ui-fg-base"
      >
        <ArrowLeft />
        Attributes
      </Link>
      <Container className="p-0">
        <div className="border-b px-6 py-4">
          <Heading level="h1">{attribute.label.en}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {attribute.value_count
              ? `Used by ${attribute.value_count} product${attribute.value_count === 1 ? "" : "s"}.`
              : "No product has a value for it yet."}
          </Text>
        </div>
        <GeneralSection attribute={attribute} />
      </Container>
      {hasOptions && (
        <Container className="p-0">
          <OptionsSection attribute={attribute} />
        </Container>
      )}
      <Container className="p-0">
        <CategoryLinks attribute={attribute} />
      </Container>
    </div>
  )
}

const AttributeDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { data, isPending, error } = useQuery({
    queryKey: ["attributes", "detail", id],
    queryFn: () => attributesApi.retrieve(id!),
    enabled: !!id,
  })

  if (error) {
    return (
      <Container>
        <Text className="text-ui-fg-error">{describeError(error)}</Text>
        <Link to="/settings/attributes" className="txt-compact-small-plus text-ui-fg-interactive">
          Back to attributes
        </Link>
      </Container>
    )
  }
  if (isPending || !data) {
    return (
      <Container>
        <Text className="text-ui-fg-subtle">Loading...</Text>
      </Container>
    )
  }
  return <AttributeDetail key={data.attribute.id} attribute={data.attribute} />
}

export default AttributeDetailPage
