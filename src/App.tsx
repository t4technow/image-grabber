/* eslint-disable no-useless-escape */
import { useEffect, useState } from "react";
import Masonry from "react-masonry-css";
import JSZip from "jszip";
import "./App.css";

type ImageInfo = {
	id: string;
	url: string;
	dimensions: { width: number; height: number };
	extension: string;
	tag: string;
	srcset?: string;
};

enum DisplayType {
	Images = "Images",
	SVGIcons = "SVG Icons",
}

function App() {
	const [images, setImages] = useState<ImageInfo[]>([]);
	const [selectedImages, setSelectedImages] = useState<string[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [siteName, setSiteName] = useState<string>("selected images");
	const [displayType, setDisplayType] = useState<DisplayType>(
		DisplayType.Images
	);

	// let baseUrl = "/";
	const fetchImages = async () => {
		const [tab] = await chrome.tabs.query({ active: true });

		chrome.scripting.executeScript(
			{
				target: { tabId: tab.id! },
				func: () => {
					const imageElements = document.querySelectorAll("img, svg");
					const imageInfo = Array.from(imageElements).map((element) => {
						let url, dimensions, extension, id, srcset;

						if (element instanceof HTMLImageElement) {
							const width = element.naturalWidth;
							const height = element.naturalHeight;
							id = `${element.src}-${width}x${height}`;

							url = element.src;
							dimensions = {
								width,
								height,
							};
							const fileNameMatch = url.match(/\/([^\/?]+(\.[a-z]+)(\?.+)?)$/i);
							extension = fileNameMatch ? fileNameMatch[2] : "jpg";

							// Check if srcset attribute exists
							srcset = element.srcset;
						} else if (element.tagName.toLowerCase() === "svg") {
							id = url = element.outerHTML;
							const svgParser = new DOMParser();
							const svgDocument = svgParser.parseFromString(
								url,
								"image/svg+xml"
							);
							const svgElement = svgDocument.querySelector("svg");

							dimensions = {
								width: svgElement ? svgElement?.width?.baseVal?.value : 0,
								height: svgElement ? svgElement?.height?.baseVal?.value : 0,
							};
							extension = "svg";
						}

						return {
							id,
							url,
							dimensions,
							extension,
							tag: element.tagName.toLowerCase(),
							srcset,
						};
					});

					return imageInfo;
				},
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(result: any) => {
				const uniqueImages = Array.from(new Set(result[0].result));

				console.log(uniqueImages);
				setImages(uniqueImages as ImageInfo[]);
				setLoading(false);
			}
		);
	};

	const fetchSiteName = async () => {
		const [tab] = await chrome.tabs.query({ active: true });

		chrome.scripting.executeScript(
			{
				target: { tabId: tab.id! },
				func: () => {
					// baseUrl = window.location.protocol + "//" + window.location.host;
					const hostName = window.location.hostname;
					return hostName;
				},
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(result: any) => {
				setSiteName(result[0].result);
			}
		);
	};

	useEffect(() => {
		fetchImages();
		fetchSiteName();
	}, []);

	const toggleImageSelection = (imageId: string) => {
		setSelectedImages((prevSelectedImages) => {
			if (prevSelectedImages.includes(imageId)) {
				return prevSelectedImages.filter((img) => img !== imageId);
			} else {
				return [...prevSelectedImages, imageId];
			}
		});
	};

	const downloadSelectedImages = async () => {
		const zip = new JSZip();

		await Promise.all(
			selectedImages.map(async (image, index) => {
				const selectedImage = images.find((img) => img.id === image);

				console.log(selectedImage, "mmmmmmmmmmm");

				if (selectedImage && selectedImage.srcset) {
					const srcsetUrls = selectedImage.srcset.split(", ");
					let closestSize = findClosestSize(
						selectedImage.dimensions.width,
						srcsetUrls
					);

					if (!closestSize.startsWith("http")) {
						// Handle different cases for URLs in srcset
						const baseImageUrl = selectedImage.url; // The base image URL
						const baseUrlMatch = baseImageUrl.match(/^(https?:\/\/[^\/]+)/);
						const baseUrl = baseUrlMatch ? baseUrlMatch[1] : ""; // Extract base URL

						if (closestSize.startsWith("//")) {
							// Handle protocol-relative URLs
							closestSize = `http:${closestSize}`;
						} else if (closestSize.startsWith("/")) {
							// Handle path-relative URLs
							closestSize = `${baseUrl}${closestSize}`;
						} else if (closestSize.startsWith("data:")) {
							// Handle data URLs
							const response = await fetch(baseImageUrl);
							const blob = await response.blob();
							zip.file(`Image_${index + 1}.${selectedImage.extension}`, blob);
							return; // Skip the rest of the loop for data URLs
						} else {
							// Handle other cases (e.g., different protocols, custom schemes)
							// You may need to add more cases based on your specific requirements
							// Ensure you handle different URL formats appropriately
							console.log("error");
						}
					}

					const response = await fetch(closestSize);
					const blob = await response.blob();
					zip.file(
						`Image_${selectedImage.dimensions.width}x${selectedImage.dimensions.height}${selectedImage.extension}`,
						blob
					);
				} else if (selectedImage && selectedImage.url.startsWith("<svg")) {
					const svgBlob = new Blob([selectedImage.url], {
						type: "image/svg+xml",
					});
					zip.file(`SVG_${index + 1}.svg`, svgBlob);
				} else if (selectedImage) {
					const response = await fetch(selectedImage.url);
					const blob = await response.blob();
					zip.file(
						`Image_${selectedImage.dimensions.width}x${selectedImage.dimensions.height}${selectedImage.extension}`,
						blob
					);
				}
			})
		);

		const content = await zip.generateAsync({ type: "blob" });

		const zipFileName = `${siteName} - image grabber.zip`;
		const link = document.createElement("a");
		link.href = URL.createObjectURL(content);
		link.download = zipFileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setSelectedImages([]);
	};

	const findClosestSize = (selectedWidth: number, srcsetUrls: string[]) => {
		const sizes = srcsetUrls.map((url) => {
			const sizeMatch = url.match(/(\d+)w/);
			return sizeMatch ? parseInt(sizeMatch[1]) : 0;
		});

		console.log(sizes, "sizes");

		const closestSize = sizes.reduce((prev, curr) => {
			return Math.abs(curr - selectedWidth) < Math.abs(prev - selectedWidth)
				? curr
				: prev;
		});

		console.log(closestSize, "closest size");

		console.log(srcsetUrls, "set");

		const closestSizeIndex = sizes.indexOf(closestSize);
		return srcsetUrls[closestSizeIndex].split(" ")[0];
	};

	const filterImagesByType = (imageType: DisplayType) => {
		switch (imageType) {
			case DisplayType.Images:
				return images.filter(
					(image) => image.tag === "img" && image.extension !== "svg"
				);
			case DisplayType.SVGIcons:
				return images.filter(
					(image) =>
						image.tag === "svg" ||
						(image.tag === "img" && image.extension === "svg")
				);
			default:
				return [];
		}
	};

	const breakpointColumnsObj = {
		default: 3,
		1100: 3,
		700: 2,
	};

	return (
		<>
			<div className="tabs">
				<button
					onClick={() => setDisplayType(DisplayType.Images)}
					className={displayType === DisplayType.Images ? "active" : ""}
				>
					Images
				</button>
				<button
					onClick={() => setDisplayType(DisplayType.SVGIcons)}
					className={displayType === DisplayType.SVGIcons ? "active" : ""}
				>
					SVG Icons
				</button>
			</div>
			<div className="tab-offset" />
			{loading ? (
				<h2>Loading...</h2>
			) : (
				<>
					<Masonry
						breakpointCols={breakpointColumnsObj}
						className="image-grid"
						columnClassName="image-grid_column"
					>
						{filterImagesByType(displayType).length > 0 &&
							filterImagesByType(displayType).map((image, indx) => (
								<div
									key={indx}
									className={`image-item ${
										selectedImages.includes(image.id) ? "selected" : ""
									}`}
								>
									<div className="tags d-flex">
										{!image.url.startsWith("<svg") && (
											<span className="tag">{`${image.dimensions.width} x ${image.dimensions.height}`}</span>
										)}
										<span className="tag">{image.extension}</span>
									</div>
									{image.url.startsWith("<svg") ? (
										<div
											dangerouslySetInnerHTML={{ __html: image.url }}
											onClick={() => toggleImageSelection(image.id)}
										/>
									) : (
										<img
											src={image.url}
											alt={`Image ${indx + 1}`}
											onClick={() => toggleImageSelection(image.id)}
										/>
									)}
									{selectedImages.includes(image.id) && (
										<div
											className="overlay"
											onClick={() => toggleImageSelection(image.id)}
										>
											<span>&#10003;</span>
										</div>
									)}
								</div>
							))}
					</Masonry>
					{filterImagesByType(displayType).length <= 0 && (
						<div className="empty">No {displayType} found</div>
					)}
					<div className="download-button-container">
						<button
							onClick={downloadSelectedImages}
							disabled={selectedImages.length === 0}
						>
							{selectedImages.length > 0
								? "Download Selected Images"
								: "Please select any image"}
						</button>
					</div>
				</>
			)}
		</>
	);
}

export default App;
