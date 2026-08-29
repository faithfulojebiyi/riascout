import React, { useEffect } from 'react'

import { WithContext as ReactTags } from 'react-tag-input'

import { css, cx } from '@riascout-ui/styled-system/css'
import { Box } from '@riascout-ui/styled-system/jsx'

import { inputStyles } from '../input'

type Tag = any

type Props = {
	value: string[]
	setValue: (val: string[]) => void
	suggestions?: Tag[]
	placeholder?: string
	labelField?: string
	autofocus?: boolean
	allowDeleteFromEmptyInput?: boolean
	autocomplete?: boolean
	allowDragDrop?: boolean
	allowUnique?: boolean
	minQueryLength?: number
	readOnly?: boolean
	inline?: boolean
	name?: string
	id?: string
	handleTagClick?: (index: number) => void
	handleInputChange?: (val: string) => void
	handleInputFocus?: (val: string) => void
	handleInputBlur?: (val: string) => void
	classNames?: {
		tags?: string
		tagInput?: string
		tagInputField?: string
		selected?: string
		tag?: string
		remove?: string
		suggestions?: string
		activeSuggestion?: string
		editTagInput?: string
		editTagInputField?: string
		clearAll?: string
	}
}

const KeyCodes = {
	comma: 188,
	enter: 13
}

const delimiters = [KeyCodes.comma, KeyCodes.enter]

export const TagInput = ({ classNames, handleInputChange, value = [], setValue, ...props }: Props) => {
	const [tags, setTags] = React.useState<Tag[]>(value.map((val) => ({ id: val, text: val })))

	useEffect(() => {
		setTags(value.map((val) => ({ id: val, text: val })))
	}, [value])

	const handleDelete = (i: number) => {
		const updatedTags = tags.filter((_tag, index) => index !== i)
		setTags(updatedTags)
		setValue(updatedTags.map((tag) => tag.id))
	}

	const handleAddition = (tag: Tag) => {
		const newVal = [...tags, tag]
		setTags(newVal)
		setValue(newVal.map((val) => val.id))
	}

	const handleDrag = (tag: Tag, currPos: number, newPos: number) => {
		const newTags = tags.slice()

		newTags.splice(currPos, 1)
		newTags.splice(newPos, 0, tag)

		// re-render
		setTags(newTags)
	}

	const handleTagClick = (/* index: number */) => {
		//
	}

	const handleInputBlur = (textInputValue: string) => {
		// Add the current text input value to the tags
		if (textInputValue.trim() !== '') {
			const newTag = { id: textInputValue, text: textInputValue }
			handleAddition(newTag)
		}
	}

	return (
		<Box>
			<ReactTags
				autocomplete
				classNames={{
					activeSuggestion: cx(classNames?.activeSuggestion),
					clearAll: '',
					editTagInput: '',
					editTagInputField: '',
					remove: cx(
						css({
							_hover: {
								'& svg': {
									fill: 'text.error !important'
								}
							},

							'& svg': {
								fill: 'text.app !important',
								h: '8px !important',
								w: '8px !important'
							},
							cursor: 'pointer',
							fontSize: '1',
							ml: '1'
						}),
						classNames?.remove
					),
					selected: cx(classNames?.selected),
					suggestions: cx(classNames?.suggestions),
					tag: cx(
						css({
							alignItems: 'center',
							bg: 'background.muted',
							display: 'inline-flex',
							justifyItems: 'center',
							mb: '1',
							mr: '1',
							px: '1.5',
							rounded: 'sm'
						}),
						classNames?.tag
					),
					tagInput: cx(classNames?.tagInput),
					tagInputField: cx(
						inputStyles({ size: 'sm' }),
						css({
							'&::placeholder': {
								color: 'text.placeholder'
							}
						}),
						classNames?.tagInputField
					),
					tags: cx(classNames?.tags)
				}}
				delimiters={delimiters}
				handleAddition={handleAddition}
				handleDelete={handleDelete}
				handleDrag={handleDrag}
				handleInputBlur={handleInputBlur}
				handleInputChange={handleInputChange}
				handleTagClick={handleTagClick}
				inputFieldPosition="inline"
				suggestions={[]}
				tags={tags}
				{...props}
			/>
		</Box>
	)
}
